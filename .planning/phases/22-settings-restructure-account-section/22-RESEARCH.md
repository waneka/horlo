# Phase 22: Settings Restructure + Account Section — Research

**Researched:** 2026-04-30
**Domain:** Settings IA (vertical tabs, hash-driven routing) + Supabase Auth account-management UX (email change pending state, password change with stale-session re-auth) + auth-callback type-switched redirect map
**Confidence:** HIGH (tooling, APIs, patterns all verified) with **one CRITICAL contradiction surfaced for the planner / discuss-phase to reconcile** — see "Critical Discrepancy: D-08 vs Supabase Server-Side Reauth Check" below.

## Summary

The phase is a tabs-shell + account-section build with **no schema changes** and **one targeted server-side route change** (`/auth/callback`). All ecosystem primitives are already in the codebase: `@base-ui/react` Tabs (with `data-vertical`-aware Tailwind already wired), Sonner via `<ThemedToaster />`, Supabase JS clients (server + browser), the reset-password / login-form patterns to mirror. The work is composition, not foundation.

Two known-unknowns from CONTEXT.md `<specifics>` are **answered HIGH** by this research:
1. **Next.js 16 `redirect('/settings#preferences')` preserves the URL fragment** in the `Location` header. Verified by reading `node_modules/next/dist/.../add-path-prefix.js` (the helper explicitly preserves `hash`) and `node_modules/next/dist/server/app-render/app-render.js:4269-4270` (which calls `setHeader('location', redirectUrl)` verbatim). The fallback Client Component `useEffect` redirect in D-15 is **not** required.
2. **base-ui Tabs supports `orientation="vertical"`** as a first-class prop, with full controlled `value` + `onValueChange` (TabsRootProps in `node_modules/@base-ui/react/tabs/root/TabsRoot.d.ts`). The existing `src/components/ui/tabs.tsx` wrapper already styles `group-data-vertical/tabs:flex-col` correctly.

One known-unknown from `<specifics>` is **answered with a CONTRADICTION the planner must resolve before locking task plans**:
3. **D-08 picks JWT `iat` as the freshness signal for password-change re-auth.** Supabase's server-side check in [internal/api/user.go](https://github.com/supabase/auth/blob/master/internal/api/user.go) uses `session.CreatedAt + 24h > now` — i.e., the `auth.sessions.created_at` column, not the JWT iat (which rotates on every refresh). A session that has been silently refreshed for 7 days has a fresh JWT iat (D-08 says "no re-auth needed") but a 7-day-old `session.created_at` (Supabase server says "re-auth required"). The locked decision will produce a UX where users skip the dialog client-side and then hit a 401 from `updateUser({password})` server-side. **Recommend the planner / discuss-phase revisit D-08** — see "Critical Discrepancy" section. (`user.last_sign_in_at` is the closest client-visible proxy to `session.created_at` and updates on each fresh `signInWithPassword`, not on token refresh.)

**Primary recommendation:** Build with the locked decisions (D-01..D-19) as the source of truth; raise the D-08 contradiction back to the user before the password-change task runs. Everything else is well-trodden ground.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Section Stubbing & Migration:**
- **D-01:** Migrate today's working Privacy + Notifications + Preferences content into their respective tabs in Phase 22 (no functional regression). Privacy tab inherits today's three `<PrivacyToggleRow>` (`profilePublic`/`collectionPublic`/`wishlistPublic`). Notifications tab inherits `notifyOnFollow`/`notifyOnWatchOverlap`. Preferences tab embeds `<PreferencesClient>` unchanged. Profile + Appearance ship as "Coming in Phase 23" stubs.
- **D-02:** Today-shipping "Collection → Taste Preferences" link row in `SettingsClient.tsx` is removed.
- **D-03:** Today-shipping "Account → Change Password / Blocked Users / Delete Account" stubs deleted. Delete-Account Dialog wiring removed entirely (SET-13 deferred to v5+).
- **D-04:** Today-shipping "Coming soon" stubs (Theme / Download Data / Export Collection / New Note Visibility disabled-Select) removed.

**Email-Change Pending UX:**
- **D-05:** Pending state lives in a persistent inline banner directly above the email input field. `<div role="status" aria-live="polite">` with locked copy: "Confirmation sent to **old@** and **new@**. Click both links to complete the change." Banner persists across page loads; renders whenever `user.new_email` is non-null. Email input keeps showing the **current confirmed** `user.email` (SET-04 forbids showing new email as current pre-confirm).
- **D-06:** Pending banner exposes single "Resend confirmation" action (no Cancel). Resend re-fires `supabase.auth.updateUser({ email: newEmail })`. To revert, user submits a fresh email-change back to original.
- **D-07:** Second email change while first is pending is **allowed and silently overwrites** the first. Supabase replaces `auth.users.email_change` natively.

**Password Change & Re-Auth:**
- **D-08:** Stale-session detection computes from JWT `iat` claim on the current `access_token`. Decode JWT in Account section (server or client; `atob` on payload), compare `Date.now()/1000 - iat` against `24*3600`. **Do NOT use `session.created_at`** per locked decision rationale. **(See Critical Discrepancy section — this contradicts Supabase server enforcement.)**
- **D-09:** Re-auth dialog asks for current password only (single field). Flow: (1) form submit → (2) if stale, open dialog → (3) `signInWithPassword({email: currentUserEmail, password})` → (4) on success, immediately `updateUser({password: newPassword})` → (5) on failure surface inline neutral copy ("Password incorrect").
- **D-10:** Fresh sessions (< 24h since JWT iat per D-08) apply password change directly with no re-auth dialog. Mirrors today's `reset-password-form.tsx` pattern.

**`/auth/callback` Type-Switched Redirect Map:**
- **D-11:** All 5 `EmailOtpType` values handled explicitly with complete redirect map:
  | type | Default redirect | Notes |
  |---|---|---|
  | `signup` | `/?status=email_confirmed` | Existing default-`/`, plus success status |
  | `recovery` | `/reset-password` | Unchanged today; `next` may override |
  | `email_change` | `/settings#account?status=email_changed` | **SET-06; NEVER `next`-overridable** |
  | `magiclink` | `/?status=signed_in` | Future-ready (no UI exposes magic-link in v4.0) |
  | `invite` | `/signup?status=invited` | Dormant; map for completeness |
  Unknown / null type → `/login?error=invalid_link` (today's behavior).
- **D-12:** `next` overrides type-default redirect ONLY for `signup`, `recovery`, `magiclink`. For `email_change` the destination is **always** `/settings#account?status=email_changed` regardless of any `next` value. For `invite`, type-default wins. Same-origin guard preserved.
- **D-13:** Success status surfaces via URL `?status=` query param + a one-shot Sonner toast. Destination page reads `useSearchParams()` for `status`, fires `toast.success(...)` on matching value, then strips the param via `router.replace(pathname + (currentHash ?? ''))`. Use existing `<ThemedToaster />`. **Toast-only at this phase**; UX-06 hybrid toast+banner ships in Phase 25.
- **D-14:** For `/settings#account?status=email_changed`, the strip-on-mount **must preserve the hash** (use `router.replace(pathname + window.location.hash)` or equivalent; naïve `router.replace(pathname)` drops `#account`).

**`/preferences` Redirect:**
- **D-15:** Convert `/preferences/page.tsx` to `redirect('/settings#preferences')` (server-side, fragment in literal string). RFC 7231 §7.1.2 preservation. **Verify in Plan**: confirm Next.js 16 `redirect()` preserves the fragment in the production Location header. **(See Open Questions — VERIFIED HIGH by code-read in this research; the Plan can drop the fallback.)**

**Hash-Driven Tab Routing:**
- **D-16:** Hash format = `#tab` for basic case, `#tab?key=value` for status-carrying links (e.g. `#account?status=email_changed`). Parser: `const [tab, query] = hash.slice(1).split('?', 2); const params = new URLSearchParams(query ?? '')`. Non-standard but mandated by SET-06.
- **D-17:** Default tab if no hash = `#account` (first canonical tab). Set via `window.history.replaceState(null, '', '/settings#account')` on mount when hash is empty.
- **D-18:** A `hashchange` event listener handles browser back/forward navigation between tabs.

**Profile Tab (Claude's Discretion above; locked here):**
- **D-19:** Profile tab renders read-only display (`displayName` / `username` / avatar from `getProfileById`) plus `<Link href="/u/{username}">View public profile</Link>` button + "Profile editing coming soon" note. Phase 25 (UX-08) will replace.

### Claude's Discretion

- **Backout / fallback strategy for D-15** — Planner discretion if Next.js 16 fragment preservation does NOT work; this research **VERIFIED** it does work, so the discretion collapses to "no fallback needed."
- **Component file naming / factoring** — Illustrative names in CONTEXT.md `<code_context>` (`SettingsTabsShell.tsx`, `AccountSection.tsx`, `EmailChangePendingBanner.tsx`, etc.) are suggestions; planner picks final structure.
- **Inline JWT decode helper location** — `src/lib/auth/jwt-iat.ts` is suggested. Planner picks.
- **Stale-session detection placement** — Server (Server Component reads cookie + decodes) or client (Client Component reads `getSession()` access_token + decodes). Planner picks; client-side is simpler given the form submit is already in a Client Component.
- **Wave structure for plans** — Planner picks (e.g., Wave 0 test scaffolds, Wave 1 callback route + redirect, Wave 2 tabs shell + privacy/notif migration, Wave 3 account section).

### Deferred Ideas (OUT OF SCOPE)

- **SET-07/08** (collectionGoal + overlapTolerance selects) — Phase 23
- **SET-09** (Notifications opt-out toggle styling pass) — Phase 23
- **SET-10** (Appearance theme switch, lifted from `<InlineThemeSegmented>`) — Phase 23
- **SET-11** (Privacy restyle pass) — Phase 23
- **FEAT-07/08** (per-note `notesPublic`, `isChronometer` toggle) — Phase 23 (lives outside Settings)
- **UX-06** (hybrid Sonner + `aria-live` banner) — Phase 25; this phase ships toast-only
- **SET-13** (Delete Account / Danger Zone) — v5+
- **SET-14** (Branded HTML email templates) — already deferred per Phase 21
- **Supabase `auth.reauthenticate()` nonce flow** — Considered for D-09 password re-auth and rejected (adds Resend round-trip, blocks on inbox latency)
- **Magic-link signin flow** — D-11 maps `magiclink → /?status=signed_in` for future-proofing only; no v4.0 UI exposes it
- **Invite flow** — D-11 maps `invite → /signup?status=invited` for completeness; horlo doesn't expose invitations
- **Profile tab editing** — D-19 ships read-only; UX-08 (Phase 25) ships the edit form

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SET-01 | `/settings` is a single-page vertical-tabs layout using `@base-ui/react` Tabs with `orientation="vertical"` | base-ui Tabs supports `orientation` prop (TabsRootProps); existing `src/components/ui/tabs.tsx` wrapper already styles vertical via `group-data-vertical/tabs:flex-col`. See "Standard Stack — base-ui Tabs" |
| SET-02 | Tab state is hash-driven via `window.location.hash` + `useEffect` (uses `window.history.pushState`, NOT `router.push`) | Pattern documented in "Architecture Patterns — Hash-Driven Tab Routing" with hash-with-querystring parser, hashchange listener, default-tab replaceState |
| SET-03 | Sections ordered Account / Profile / Preferences / Privacy / Notifications / Appearance | Pure data-driven tabs array; no library constraint |
| SET-04 | User can change email via `updateUser({ email })` with pending banner; UI does NOT show new email as current | `User.new_email` is the canonical pending-state field (verified in `node_modules/@supabase/auth-js/dist/module/lib/types.d.ts:348`); `updateUser({email})` returns `{ user: { new_email, email_change_sent_at, ... } }`. See "Architecture Patterns — Email Change Pending State" |
| SET-05 | User can change password via `updateUser({ password })` with re-auth dialog for stale sessions | `updateUser({password})` returns `UserResponse`. Re-auth via `signInWithPassword({email,password})`. **D-08's JWT-iat freshness signal contradicts Supabase server enforcement** — see Critical Discrepancy |
| SET-06 | `/auth/callback/route.ts` extends to switch on `type` with redirect map (post-`email_change` → `/settings#account?status=email_changed`) | EmailOtpType union: `'signup' \| 'invite' \| 'magiclink' \| 'recovery' \| 'email_change' \| 'email'` (verified in types.d.ts:684). Pattern in "Code Examples — Auth Callback Type Switch" |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

| Directive | Source | Implication for Phase 22 |
|-----------|--------|--------------------------|
| **Tech stack: Next.js 16 App Router, no rewrites** | CLAUDE.md "Constraints" | Use App Router conventions; do not introduce Pages Router |
| **"This is NOT the Next.js you know" — read `node_modules/next/dist/docs/` before writing code** | AGENTS.md | When in doubt about `redirect()`, route handlers, `useSearchParams()`, etc. — verify against bundled docs. This research did so for `redirect()` fragment preservation. |
| **`async cookies()` in Server Components — `await cookies()` is REQUIRED in Next.js 16** | `src/lib/supabase/server.ts:6` inline comment | Already-shipped pattern. Settings Server Component reads via `getCurrentUser()` which already follows this. |
| **No `pages/` directory; App Router only** | CLAUDE.md Stack | All new files under `src/app/` |
| **Path alias `@/*` → `./src/*`; no `../../` traversals** | CLAUDE.md Conventions | All imports use `@/`; no relative parent paths |
| **PascalCase components / camelCase non-component files** | CLAUDE.md Conventions | Settings sections like `AccountSection.tsx`, helper like `jwtIat.ts` (camelCase) |
| **`'use client'` on stateful UI; Server Components default** | CLAUDE.md Conventions | `/settings/page.tsx` stays Server (fetches profile + settings); tabs shell is `'use client'` |
| **Strict TypeScript; central types in `src/lib/types.ts`** | CLAUDE.md Conventions | New `SettingsTab` discriminated union in `src/lib/types.ts` (or co-located) |
| **No barrel files** | CLAUDE.md Conventions | Each component imported directly |
| **`cn()` from `src/lib/utils.ts` for conditional classes; Tailwind CSS 4 inline** | CLAUDE.md Conventions | Existing pattern; reuse |
| **API routes: validate input → early return; URL allow-list** | CLAUDE.md Conventions | `/auth/callback/route.ts` already follows this; preserve `safeNext` guard per D-12 |
| **GSD Workflow Enforcement** | CLAUDE.md | Run through `/gsd-execute-phase` for plan execution; no direct edits outside GSD |
| **Sonner mounted via `<ThemedToaster />` at root layout — INSIDE ThemeProvider, OUTSIDE Suspense** | `src/components/ui/ThemedToaster.tsx` Pitfall H-1; `src/app/layout.tsx:65-68` | D-13 toast call sites just `import { toast } from 'sonner'`; no layout changes needed |
| **Toast call sites: Client Component handlers only — never from Server Action body** | `src/components/ui/ThemedToaster.tsx` Pitfall H-2 | D-13 toast fires from a Client Component reading `useSearchParams()` |

## Standard Stack

### Core (already installed; no new deps required)

| Library | Version (installed / latest) | Purpose | Why Standard |
|---------|------------------------------|---------|--------------|
| `@base-ui/react` | 1.3.0 / **1.4.1** available [VERIFIED: npm view] | Headless Tabs primitive with `orientation="vertical"`, `Dialog`, `controlled value`/`onValueChange` | Already the project's UI primitive layer; `src/components/ui/tabs.tsx` wrapper already supports vertical |
| `@supabase/supabase-js` | 2.103.0 / **2.105.1** available [VERIFIED: npm view] | `auth.updateUser({email,password})`, `auth.signInWithPassword`, `auth.getUser()`, `auth.verifyOtp` | Already in use; SDK exposes `User.new_email` + `User.email_change_sent_at` for pending state |
| `@supabase/ssr` | 0.10.2 [VERIFIED: project package.json] | Server + browser Supabase clients used in Account section + auth-callback route | Already wired (`src/lib/supabase/server.ts` + `client.ts`) |
| `sonner` | 2.0.7 [VERIFIED: project package.json] | Success-status toast (D-13) | Already mounted via `<ThemedToaster />`; existing call sites in WatchSearchRowsAccordion, ComposeStep, CatalogPageActions |
| `next` | 16.2.3 [VERIFIED: project package.json] | App Router, `redirect()`, route handlers, `useRouter`, `useSearchParams`, `usePathname` | Project is locked to Next 16 (CLAUDE.md constraint) |

### Supporting (already installed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `lucide-react` | ^1.8.0 | Icons for tab triggers (User / IdCard / Sliders / Lock / Bell / Palette) | Section icons inside `<TabsTrigger>` |
| `class-variance-authority` + `clsx` + `tailwind-merge` | as in package.json | Tab variants + conditional class merging | Existing `cn()` from `@/lib/utils` |
| `@testing-library/react` 16.3.2 + `vitest` 2.1.9 + `jsdom` 25.0.1 | as in package.json | Component + integration tests for tabs shell, account section, callback route | Wave 0 test scaffolds |

### Alternatives Considered

| Instead of | Could Use | Tradeoff | Verdict |
|------------|-----------|----------|---------|
| Decoding JWT inline with `atob` | `jose` or `jwt-decode` library | Adds 5–15kb runtime; `atob` + `JSON.parse` is 4 lines for read-only `iat` extraction | **Use `atob`**; matches D-08 guidance and avoids new dep |
| Hash-routing via `useSyncExternalStore` | Simple `useEffect` + `useState` listening to `hashchange` | `useSyncExternalStore` better for SSR-derived state, but Tabs shell is `'use client'` and hydration concern doesn't apply | **Use `useEffect` + `hashchange`**; keep it dead simple |
| Supabase `auth.reauthenticate()` (nonce-via-email flow) | Direct `signInWithPassword` re-auth | nonce flow blocks user on inbox; current-password challenge is instant. Already rejected in CONTEXT.md `<deferred>` | **Use signInWithPassword** per D-09 |
| Server Component `redirect('/settings#preferences')` | Client Component `useEffect(() => window.location.replace(...))` fallback | RFC 7231 + verified Next.js 16 source code preserves fragment | **Use server-side `redirect`** per D-15; no fallback needed |

**Installation:** No new dependencies needed.

**Version verification:**
```
npm view @base-ui/react version    → 1.4.1   (project: 1.3.0)
npm view sonner version            → 2.0.7   (project: 2.0.7) ✓
npm view @supabase/supabase-js     → 2.105.1 (project: 2.103.0)
npm view @supabase/ssr             → 0.10.2  (project: 0.10.2) ✓
```
Versions are close enough that no upgrade is required for Phase 22 capabilities. Defer upgrades to a separate quick-fix.

## Architecture Patterns

### Recommended File Structure

```
src/
├── app/
│   ├── settings/
│   │   └── page.tsx                          # Server Component — fetches profile + settings + user; renders <SettingsTabsShell>
│   ├── preferences/
│   │   └── page.tsx                          # 1-line redirect: redirect('/settings#preferences')
│   └── auth/
│       └── callback/
│           └── route.ts                      # Extended ~24 → ~80 lines: 5-type switch + redirect map (D-11/D-12)
├── components/
│   └── settings/
│       ├── SettingsTabsShell.tsx             # 'use client' — base-ui vertical Tabs + hash routing (D-16/17/18)
│       ├── AccountSection.tsx                # Email + password forms + status-toast handler
│       ├── EmailChangeForm.tsx               # Submit → updateUser({email}); reads user.new_email for banner gate
│       ├── EmailChangePendingBanner.tsx      # D-05 inline banner; D-06 Resend action (no Cancel)
│       ├── PasswordChangeForm.tsx            # New + confirm; on submit, branch on stale flag
│       ├── PasswordReauthDialog.tsx          # D-09 single-field dialog; signInWithPassword → updateUser({password})
│       ├── ProfileSection.tsx                # D-19 read-only stub
│       ├── PrivacySection.tsx                # Migrated from SettingsClient (3x PrivacyToggleRow)
│       ├── NotificationsSection.tsx          # Migrated from SettingsClient (2x notify toggles)
│       ├── PreferencesSection.tsx            # Embeds <PreferencesClient> unchanged
│       └── AppearanceSection.tsx             # Stub (Phase 23)
└── lib/
    └── auth/
        └── jwtIat.ts                         # Browser-safe atob+JSON.parse helper for D-08 freshness check
```

### Pattern 1: base-ui Tabs with vertical orientation + controlled value

**What:** `Tabs.Root` accepts `value` (controlled) + `onValueChange` + `orientation="vertical"`. Existing `src/components/ui/tabs.tsx` wrapper passes `data-orientation` and styles `group-data-vertical/tabs:flex-col`.

**When to use:** Settings page, inside `<SettingsTabsShell>` Client Component. The wrapper accepts `Tabs.Root.Props` directly so we can pass `value` + `onValueChange`.

**Example** (from `node_modules/@base-ui/react/tabs/root/TabsRoot.d.ts:24-45` [VERIFIED] + existing wrapper):

```tsx
'use client'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

const SECTION_ORDER = ['account', 'profile', 'preferences', 'privacy', 'notifications', 'appearance'] as const
type SectionId = typeof SECTION_ORDER[number]

export function SettingsTabsShell(props: { /* user, profile, settings, preferences */ }) {
  const [activeTab, setActiveTab] = useState<SectionId>('account')

  // Hash routing wired below in Pattern 2

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        // Use pushState (NOT router.push) per SET-02
        const next = value as SectionId
        setActiveTab(next)
        window.history.pushState(null, '', `#${next}`)
      }}
      orientation="vertical"
      className="gap-6"
    >
      <TabsList variant="line" className="w-44">
        {SECTION_ORDER.map((id) => (
          <TabsTrigger key={id} value={id}>{LABEL_FOR[id]}</TabsTrigger>
        ))}
      </TabsList>
      <div className="flex-1">
        <TabsContent value="account"><AccountSection {...props} /></TabsContent>
        <TabsContent value="profile"><ProfileSection {...props} /></TabsContent>
        {/* ... */}
      </div>
    </Tabs>
  )
}
```

[CITED: `node_modules/@base-ui/react/tabs/root/TabsRoot.d.ts` — `orientation?: TabsRoot.Orientation`, `value?: TabsTab.Value`, `onValueChange?: (value, eventDetails) => void`]

### Pattern 2: Hash-Driven Tab Routing (D-16/D-17/D-18)

**What:** Read `window.location.hash` on mount, write via `window.history.pushState` on tab change, listen to `hashchange` for back/forward.

**When to use:** `<SettingsTabsShell>` mount + tab change. **NOT `router.push`** — that re-runs the page Server Component loader (SET-02 explicit).

**Example:**

```tsx
'use client'
import { useEffect, useState } from 'react'

const SECTION_ORDER = ['account', 'profile', 'preferences', 'privacy', 'notifications', 'appearance'] as const
type SectionId = typeof SECTION_ORDER[number]
const isSectionId = (s: string): s is SectionId =>
  (SECTION_ORDER as readonly string[]).includes(s)

/**
 * D-16: Hash format is `#tab` for the basic case and `#tab?key=value` for
 * status-carrying links (e.g., `#account?status=email_changed` per SET-06).
 * Returns [tab, params].
 */
function parseHash(hash: string): [SectionId, URLSearchParams] {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash
  const [tab, query] = raw.split('?', 2)
  const params = new URLSearchParams(query ?? '')
  const safe: SectionId = isSectionId(tab) ? tab : 'account'
  return [safe, params]
}

export function SettingsTabsShell() {
  const [activeTab, setActiveTab] = useState<SectionId>('account')

  // Mount: read hash; if empty, replaceState to #account (D-17)
  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, '', '/settings#account')
      return
    }
    const [tab] = parseHash(window.location.hash)
    setActiveTab(tab)
  }, [])

  // D-18: hashchange handles back/forward
  useEffect(() => {
    function onHashChange() {
      const [tab] = parseHash(window.location.hash)
      setActiveTab(tab)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // ... <Tabs value={activeTab} onValueChange={...}>
}
```

**Anti-pattern:** Using `router.push('/settings#account')` instead of `pushState`. The Next.js router treats hash as part of the route in some scenarios and re-runs the Server Component loader, defeating the SPA tab-switch UX.

### Pattern 3: Email Change Pending State (D-05/D-06/D-07)

**What:** Pending state lives entirely in Supabase (`auth.users.email_change` + `email_change_sent_at`); the JS client surfaces it as `user.new_email` + `user.email_change_sent_at` on the User returned by `getUser()` and `updateUser()`.

**Key API surface** (verified in `node_modules/@supabase/auth-js/dist/module/lib/types.d.ts:340-367`):

```ts
export interface User {
  id: string
  email?: string                    // Current confirmed email — D-05 keeps showing this in the input
  new_email?: string                // Pending email — D-05 banner gate
  email_change_sent_at?: string     // ISO timestamp of last email-change initiation
  email_confirmed_at?: string
  // ... other fields
}
```

**Banner render gate:** `if (user.new_email) { <EmailChangePendingBanner pendingEmail={user.new_email} oldEmail={user.email} /> }`

**Submit flow (initial change):**
```ts
const supabase = createSupabaseBrowserClient()
const { data, error } = await supabase.auth.updateUser({ email: newEmail })
// data.user.new_email === newEmail (verified)
// data.user.email_change_sent_at === ISO timestamp (verified)
// data.user.email is UNCHANGED until both confirmation links clicked
```

**Resend flow (D-06):** Re-fire identical `updateUser({ email: newEmail })`. Supabase replaces `email_change` server-side; both confirmation emails are re-issued. **Do NOT use `supabase.auth.resend({ type: 'email_change' })`** — that resends the existing `email_change_token`; calling `updateUser` re-issues fresh tokens which is what the user expects when clicking "Resend confirmation."

**Second change while pending (D-07):** Identical to initial — Supabase replaces `email_change` natively. UI just re-renders banner with the latest target.

**Confirmation completion:** When BOTH confirmation links are clicked (Secure email change is ON per Phase 21), `auth.users.email = new_email`, `auth.users.email_change` clears, `auth.users.new_email` becomes null. Next `getUser()` call returns no `new_email` → banner unmounts.

**Known footgun (cited):** [GitHub Discussion #42520](https://github.com/orgs/supabase/discussions/42520) reports that `getUser()` may briefly return stale state right after the first confirmation. This is a UX-layer race; mitigation is to trust the eventual consistent state on next render. The banner copy is forgiving enough ("Click both links to complete the change") that a 1–2s stale state isn't user-visible.

[CITED: `node_modules/@supabase/auth-js/dist/module/GoTrueClient.d.ts:1475-1591` — exact `updateUser` JSDoc + response shape including `new_email` and `email_change_sent_at`]

### Pattern 4: Password Change with Stale-Session Re-Auth (D-08/D-09/D-10)

**Per CONTEXT.md D-08, the freshness signal is JWT `iat`** (issued-at claim). Decode browser-side via `atob`:

```ts
// src/lib/auth/jwtIat.ts — D-08 helper
/**
 * Returns the issued-at unix timestamp (seconds) from a Supabase access token,
 * or null if the token is malformed.
 *
 * Browser-safe: uses atob + JSON.parse. No dependency.
 *
 * NOTE: This is the JWT `iat` claim, which RESETS on each token refresh. Per
 * locked decision D-08 in 22-CONTEXT.md, this is the freshness signal used by
 * the password-change re-auth dialog. **See Critical Discrepancy in this
 * RESEARCH.md — Supabase server-side enforces against `session.created_at`,
 * which the JWT iat does NOT track.**
 */
export function getJwtIat(accessToken: string): number | null {
  try {
    const payload = accessToken.split('.')[1]
    if (!payload) return null
    // atob may need padding fix; but Supabase tokens are well-formed.
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    const claims = JSON.parse(decoded) as { iat?: unknown }
    return typeof claims.iat === 'number' ? claims.iat : null
  } catch {
    return null
  }
}

export function isSessionStale(accessToken: string, thresholdSeconds = 24 * 3600): boolean {
  const iat = getJwtIat(accessToken)
  if (iat === null) return true  // Defensive: assume stale if we can't read
  return Date.now() / 1000 - iat > thresholdSeconds
}
```

**Password change flow (D-09 / D-10):**

```tsx
'use client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { isSessionStale } from '@/lib/auth/jwtIat'

async function handlePasswordSubmit(newPassword: string, confirm: string) {
  if (newPassword !== confirm) { setError('Passwords do not match.'); return }
  if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return }

  const supabase = createSupabaseBrowserClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { setError('You are not signed in.'); return }

  if (isSessionStale(session.access_token)) {
    // D-09: open re-auth dialog. The dialog handles the rest.
    setReauthState({ open: true, pendingNewPassword: newPassword })
    return
  }

  // D-10: fresh session; apply directly.
  const { error: err } = await supabase.auth.updateUser({ password: newPassword })
  if (err) { setError('Could not update password.'); return }
  toast.success('Password updated')
  // Clear form, etc.
}

// Inside <PasswordReauthDialog> on submit:
async function handleReauthSubmit(currentPassword: string) {
  const supabase = createSupabaseBrowserClient()
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: currentUserEmail,  // From getCurrentUser() prop
    password: currentPassword,
  })
  if (signInErr) { setDialogError('Password incorrect'); return }

  const { error: updErr } = await supabase.auth.updateUser({
    password: pendingNewPassword,
  })
  if (updErr) { setDialogError('Could not update password.'); return }

  closeDialog()
  toast.success('Password updated')
}
```

**Anti-pattern:** Using `auth.reauthenticate()` (nonce-via-email flow) — already rejected in CONTEXT.md `<deferred>` (blocks user on inbox latency).

### Pattern 5: Auth Callback Type Switch (D-11/D-12)

**What:** Extend `src/app/auth/callback/route.ts` from current 24-line shape to a full 5-type switch with per-type redirect map.

**Current code (`src/app/auth/callback/route.ts`):**

```ts
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'

  if (token_hash && type) {
    const supabase = await createSupabaseServerClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash })
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, origin))
    }
  }
  return NextResponse.redirect(new URL('/login?error=invalid_link', origin))
}
```

**Target shape (~80 lines):**

```ts
import { NextRequest, NextResponse } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createSupabaseServerClient } from '@/lib/supabase/server'

// EmailOtpType union from @supabase/supabase-js (verified):
//   'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email'
// We handle the 5 documented Supabase email flows + treat 'email' as alias for 'signup'.

const TYPE_DEFAULT_REDIRECT = {
  signup:        '/?status=email_confirmed',
  recovery:      '/reset-password',
  email_change:  '/settings#account?status=email_changed',  // D-12: NEVER overridable
  magiclink:     '/?status=signed_in',
  invite:        '/signup?status=invited',
} as const satisfies Record<Exclude<EmailOtpType, 'email'>, string>

// D-12: only these 3 types honor the `next` query param override.
const NEXT_OVERRIDABLE: ReadonlySet<EmailOtpType> = new Set(['signup', 'recovery', 'magiclink'])

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next')

  // Same-origin guard from today's route — preserved.
  const safeNext =
    next && next.startsWith('/') && !next.startsWith('//') ? next : null

  if (!token_hash || !type) {
    return NextResponse.redirect(new URL('/login?error=invalid_link', origin))
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.verifyOtp({ type, token_hash })
  if (error) {
    return NextResponse.redirect(new URL('/login?error=invalid_link', origin))
  }

  // Resolve destination per D-11 / D-12.
  // 'email' is a deprecated alias for 'signup' per Supabase docs — coerce to 'signup'.
  const normalizedType: Exclude<EmailOtpType, 'email'> =
    type === 'email' ? 'signup' : type

  const typeDefault = TYPE_DEFAULT_REDIRECT[normalizedType]
  const destination =
    safeNext && NEXT_OVERRIDABLE.has(normalizedType) ? safeNext : typeDefault

  return NextResponse.redirect(new URL(destination, origin))
}
```

**Why the redirect destinations preserve fragments correctly:** `NextResponse.redirect(new URL('/settings#account?status=email_changed', origin))` — the URL constructor parses fragment + query correctly; the `Location` header carries them verbatim to the browser. RFC 7231 §7.1.2 [CITED] mandates clients honor a Location-header-supplied fragment.

**Test surface (`tests/app/auth-callback-route.test.ts` — Wave 0 gap):**
- 5 type → destination map cases (one per `EmailOtpType` enumerated in D-11)
- `next` override behavior matrix (allowed for signup/recovery/magiclink; ignored for email_change/invite)
- Same-origin guard (next=`https://evil.com`, next=`//evil.com`, next=`relative` all reject)
- Error path: `verifyOtp` returns error → redirect to `/login?error=invalid_link`
- Unknown / null type → `/login?error=invalid_link`

[CITED: `node_modules/@supabase/auth-js/dist/module/lib/types.d.ts:684` — `EmailOtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email'`]

### Pattern 6: Sonner Toast + `?status=` Strip (D-13/D-14)

**What:** Destination page reads `useSearchParams()` for `status`, fires `toast.success(...)`, strips the param from URL — preserving the hash.

**Example** (mounted inside `<SettingsTabsShell>` or a small Client Component child):

```tsx
'use client'
import { useEffect } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'

export function StatusToastHandler() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const status = searchParams.get('status')
    if (!status) return

    if (status === 'email_changed') {
      toast.success('Email changed successfully')
    }
    // ... other status values

    // D-14: Preserve hash. Naïve `router.replace(pathname)` drops `#account`.
    const newSearch = new URLSearchParams(searchParams)
    newSearch.delete('status')
    const queryStr = newSearch.toString()
    const hash = typeof window !== 'undefined' ? window.location.hash : ''
    const target = `${pathname}${queryStr ? `?${queryStr}` : ''}${hash}`
    router.replace(target, { scroll: false })
  }, [searchParams, pathname, router])

  return null
}
```

**Pitfall H-1 (already documented in `<ThemedToaster />`):** Toaster sits OUTSIDE Suspense in `src/app/layout.tsx:62-68`. No layout changes needed.

**Pitfall H-2 (already documented):** Toast call sites must be Client Component handlers. The `StatusToastHandler` is `'use client'` and fires from `useEffect`.

**`useSearchParams()` Suspense boundary requirement:** Next.js 16 in non-PPR mode requires `useSearchParams()` consumers to be wrapped in `<Suspense>` to avoid prerender bailout. The `<SettingsTabsShell>` is loaded inside the Settings page; if the page does not already provide a Suspense boundary, the planner should add one around the shell or just around `<StatusToastHandler />`.

### Pattern 7: `/preferences` → `/settings#preferences` Redirect (D-15)

**Verified HIGH** in this research: Next.js 16's `redirect(url)` preserves the URL fragment in the Location header.

**Evidence chain:**
1. `node_modules/next/dist/client/components/redirect.js:51-54` — `redirect(url)` calls `getRedirectError(url, type, ...)` which packs `url` verbatim into `error.digest`. No URL parsing or fragment stripping.
2. `node_modules/next/dist/server/app-render/app-render.js:4269-4270` — error handler reads `redirectUrl = addPathPrefix(getURLFromRedirectError(err), basePath)` then calls `setHeader('location', redirectUrl)`.
3. `node_modules/next/dist/shared/lib/router/utils/add-path-prefix.js:12-18` — `addPathPrefix` explicitly preserves `hash`:
   ```js
   function addPathPrefix(path, prefix) {
     if (!path.startsWith('/') || !prefix) return path
     const { pathname, query, hash } = parsePath(path)
     return `${prefix}${pathname}${query}${hash}`
   }
   ```
4. RFC 7231 §7.1.2 [CITED] mandates browsers honor a fragment in the Location header.

**Implementation (`src/app/preferences/page.tsx`):**

```ts
import { redirect } from 'next/navigation'

export default function PreferencesPage() {
  redirect('/settings#preferences')
}
```

That's it. The page becomes a 4-line file. **No Client Component fallback needed.** [VERIFIED: code-read in node_modules]

### Pattern 8: base-ui Dialog inside base-ui Tabs (Floating UI Dismissal Pitfall)

**The pitfall:** `src/components/layout/InlineThemeSegmented.tsx:28-33` documents that base-ui's `useDismiss` (Floating UI) inside a `DropdownMenu Popup` can treat pointer events on non-MenuItem descendants as implicit outside interactions and unmount the popup before the click dispatches — swallowing `setTheme()`. The workaround is `e.stopPropagation()` on `onClick` plus `onPointerDown` / `onPointerUp` `stopPropagation`.

**Does this apply to Dialog-inside-Tabs?**
- Tabs (`@base-ui/react/tabs`) is **not** a Floating UI component — it's a tablist with roving focus, no `useDismiss`. Tabs **does NOT swallow pointer events** the way Menu does.
- Dialog (`@base-ui/react/dialog`) is a **modal** Floating UI component with its own `useDismiss` for outside-click and Escape-key dismissal.
- The re-auth Dialog will be opened from a button click inside an active TabsContent panel. The Dialog's overlay sits OUTSIDE the Tabs' DOM (it's portaled). Pointer events on the Dialog's form inputs do not interact with Tabs.

**Verdict:** The InlineThemeSegmented pitfall is unlikely to manifest for the re-auth Dialog because:
1. Tabs doesn't have a useDismiss-style listener.
2. Dialog content is portaled outside the Tabs DOM tree.
3. The form interaction is inside the Dialog's own popup, which is the topmost Floating UI layer.

**However — defense in depth:** If the planner observes any "click swallowed" symptoms during implementation, the mitigation is the same `e.stopPropagation()` + `onPointerDown / onPointerUp stopPointer` pattern from `InlineThemeSegmented.tsx:28-50`. **Verify in Plan**: include a smoke test that submits the re-auth Dialog and confirms `signInWithPassword` is called.

[CITED: `src/components/layout/InlineThemeSegmented.tsx:28-50` — documented Floating UI workaround]
[CITED: `node_modules/@base-ui/react/dialog/popup/...` — Dialog uses Floating UI; portal-rendered]

### Anti-Patterns to Avoid

- **`router.push` for tab changes** — Re-runs Server Component loader; defeats SPA UX (SET-02 explicit). Use `pushState` only.
- **Showing `user.new_email` as the "current" email pre-confirmation** — SET-04 explicit. The input keeps `user.email`; the banner shows the pending change.
- **`session.created_at` from the JS client** — There IS no `created_at` field on `Session` in `@supabase/auth-js` types.d.ts:225-256 [VERIFIED]. The closest proxy is `user.last_sign_in_at` (updates on each fresh `signInWithPassword`, not on token refresh). **D-08 chose JWT iat over this; see Critical Discrepancy.**
- **`next` override for `email_change` confirmation** — D-12 explicit. The success URL is part of the spec.
- **Cancel button on the email-change pending banner** — D-06 explicit. Resend-only; submit-again-to-revert is the mental model.
- **Schema migrations** — Phase 22 has zero application schema changes. All Account state lives in Supabase `auth.users`.
- **Calling `toast.success(...)` from a Server Action body** — Pitfall H-2 (silent failure; no DOM server-side). All status toasts in this phase fire from a Client Component reading `useSearchParams()`.
- **`router.replace(pathname)` for the `?status=` strip** — D-14 explicit. Drops the `#account` fragment. Use `pathname + window.location.hash`.
- **Deleting the `safeNext` guard in `/auth/callback/route.ts`** — D-12 preserves it for the 3 override-eligible types. Open-redirect protection.
- **Wrapping `useSearchParams()` consumer without a Suspense boundary** — Next.js 16 prerender bailout.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT decode | Custom base64-url-fix + parse loop | `atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))` + `JSON.parse` | Read-only `iat` extraction is 4 lines; libraries (`jose`/`jwt-decode`) add 5–15kb for a feature we don't need (we are NOT verifying the signature, only reading a claim) |
| Tabs (vertical orientation, roving focus, ARIA) | Custom `<button role="tab">` array | `@base-ui/react/tabs` via `src/components/ui/tabs.tsx` wrapper | The wrapper already exists; vertical mode already styled; ARIA + keyboard handled by base-ui |
| Modal Dialog (focus trap, Escape, overlay, portal) | Custom `<div>` with absolute positioning | `@base-ui/react/dialog` via `src/components/ui/dialog.tsx` wrapper | Wrapper exists; Floating UI handles trap/dismissal; portal escapes Tabs container |
| Toast UI (queue, animation, theme-aware) | Custom transient overlay | `sonner` via `<ThemedToaster />` | Already mounted; D-13 just calls `toast.success(...)` |
| Hash-with-querystring parser | Regex spaghetti | `hash.slice(1).split('?', 2)` + `URLSearchParams(query ?? '')` | 2-line solution per D-16; native APIs |
| Email-change pending state machine | Local `useState` synced to localStorage | `user.new_email` + `user.email_change_sent_at` from `getUser()` | Source of truth lives in Supabase; client just reflects it |
| Re-auth nonce flow (email + 6-digit OTP) | Custom challenge UI | Skip entirely — use `signInWithPassword` per D-09 | Already rejected in CONTEXT.md `<deferred>`; password challenge is the simpler UX |
| Browser back/forward → tab sync | Polling `window.location.hash` | `addEventListener('hashchange', ...)` per D-18 | Native event; fires on push/replace and on user back/forward |

**Key insight:** The Phase 22 build is composition over the existing primitive layer (base-ui Tabs/Dialog, Supabase JS client, Sonner). No new primitives; no new dependencies. The "real" work is the email-change pending UX + the auth-callback type switch + the JWT-iat freshness helper — each ~50 LOC.

## Common Pitfalls

### Pitfall 1: `router.push` re-runs the page Server Component loader

**What goes wrong:** Switching tabs via `router.push('/settings#account')` triggers Next.js's router transition, which re-fetches the Server Component data layer (`getProfileById`, `getProfileSettings`, etc.). The "tab switch" feels slow and the page flashes a skeleton.

**Why it happens:** Next.js treats hash changes within the same route as soft navigations and still triggers RSC re-render.

**How to avoid:** Use `window.history.pushState(null, '', '#tab')` (NOT `router.push`). This updates the URL without engaging the Next.js router. SET-02 mandates this.

**Warning signs:** Network tab shows RSC payload requests on every tab click; loading skeletons flash; data props change identity.

### Pitfall 2: `router.replace(pathname)` drops the URL fragment

**What goes wrong:** Stripping `?status=email_changed` after firing the toast removes the `#account` fragment too. User lands on default tab (Account by D-17, but if defaults change later this breaks).

**Why it happens:** `router.replace(pathname)` doesn't carry over `window.location.hash`.

**How to avoid:** Always reconstruct: `router.replace(`${pathname}${queryStr ? `?${queryStr}` : ''}${window.location.hash}`)`. D-14 explicit.

**Warning signs:** After email-change confirmation toast, URL goes from `/settings#account?status=email_changed` to `/settings` (no hash). Visually the tab might still show Account because the in-memory `activeTab` state hasn't changed, but a reload sends user to default tab.

### Pitfall 3: `useSearchParams()` without Suspense bails prerender

**What goes wrong:** Next.js 16 (non-PPR) bails prerender for any route reading `useSearchParams()` outside a Suspense boundary; the page becomes fully dynamic.

**Why it happens:** `useSearchParams()` is a client-side hook that depends on the request URL; without Suspense Next.js can't statically render the surrounding tree.

**How to avoid:** Wrap the `useSearchParams` consumer (`<StatusToastHandler />`) in `<Suspense fallback={null}>`. The Settings page itself is auth-gated and dynamic, so this is largely moot, but it's good hygiene and matches existing patterns (`/search/page.tsx` already does this).

### Pitfall 4: `getUser()` returns stale state immediately after first email confirmation

**What goes wrong:** User clicks the confirmation link in their old email; the Account section briefly shows the banner unchanged because `getUser()` hasn't seen the server-side update yet.

**Why it happens:** Documented in [GitHub Discussion #42520](https://github.com/orgs/supabase/discussions/42520) — Supabase's session/token state can lag the server-side change by 1–2 seconds.

**How to avoid:** Don't try. Banner copy "Click both links to complete the change" is forgiving; the eventual consistent state lands on next render. Do NOT add aggressive polling — it amplifies the issue.

**Warning signs:** User reports "I clicked the link but the banner is still there." Reload usually fixes it.

### Pitfall 5: Floating UI Dialog inside Tabs swallows clicks

**What goes wrong:** Re-auth Dialog opens but submit button click does nothing.

**Why it happens:** base-ui's `useDismiss` on the Dialog or a parent Floating UI layer treats internal pointer events as outside-clicks and unmounts mid-click. (Documented for InlineThemeSegmented inside a DropdownMenu.)

**How to avoid:** **Likely doesn't apply** because Tabs is not a Floating UI component and Dialog content is portaled. If observed during testing, mitigate per InlineThemeSegmented pattern: `onClick`/`onPointerDown`/`onPointerUp` `stopPropagation`. **Verify in Plan**: smoke test that submits the re-auth dialog.

**Warning signs:** Dialog visibly closes on first click attempt; `signInWithPassword` never fires.

### Pitfall 6: JWT iat is not session.created_at — see Critical Discrepancy below

**What goes wrong:** Per D-08, the client decodes `iat` and decides "fresh, no re-auth dialog." But Supabase server-side checks `session.created_at + 24h > now`. A 7-day-old session with a fresh JWT (refreshed 5 min ago) passes the client check, fails the server check. User sees a 401 from `updateUser({password})`.

**Why it happens:** JWT `iat` rotates on every token refresh; `session.created_at` is set once at fresh sign-in.

**How to avoid:** Either (a) revisit D-08 in discuss-phase and use `user.last_sign_in_at` (the closest client-visible proxy to `session.created_at`); or (b) handle the 401 from `updateUser` by re-opening the dialog with a "Please sign in again to continue" message.

**Warning signs:** Users report "I changed my password yesterday and now it says incorrect" — actually the password change failed silently because re-auth was bypassed.

### Pitfall 7: `redirect()` called inside try/catch

**What goes wrong:** `redirect()` throws `NEXT_REDIRECT`; if caught and swallowed, the redirect doesn't propagate.

**Why it happens:** Documented in Next.js redirect docs — redirect throws and must be uncaught.

**How to avoid:** In `/preferences/page.tsx`, call `redirect()` outside any try/catch. The current `/settings/page.tsx` already follows this pattern (its try/catch sets a flag and calls `redirect()` outside). Mirror this if there's any setup before the redirect; for a simple `/preferences/page.tsx` the redirect is the only line.

**Warning signs:** `/preferences` returns a blank page or 200 OK with no redirect.

### Pitfall 8: Drop the same-origin guard on `next`

**What goes wrong:** `next=https://evil.com` redirects users off-site after auth.

**Why it happens:** Open redirect attack vector if the guard is removed.

**How to avoid:** Keep the existing `safeNext = next.startsWith('/') && !next.startsWith('//') ? next : null` guard. Only consult it for the 3 override-eligible types per D-12.

## Code Examples

Verified patterns from official sources and existing codebase:

### Read User + Pending Email State (Server Component)

```ts
// src/app/settings/page.tsx — Server Component
import { redirect } from 'next/navigation'
import { getCurrentUser, UnauthorizedError } from '@/lib/auth'
import { getProfileById, getProfileSettings } from '@/data/profiles'
import { getPreferencesByUser } from '@/data/preferences'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SettingsTabsShell } from '@/components/settings/SettingsTabsShell'

export default async function SettingsPage() {
  // Existing redirect-on-unauth pattern (preserved per CONTEXT.md):
  let user: { id: string; email: string } | null = null
  let needsLogin = false
  try { user = await getCurrentUser() }
  catch (err) {
    if (err instanceof UnauthorizedError) needsLogin = true
    else throw err
  }
  if (needsLogin || !user) redirect('/login?next=/settings')

  // Fetch profile + settings + preferences (all parallel)
  const [profile, settings, preferences] = await Promise.all([
    getProfileById(user.id),
    getProfileSettings(user.id),
    getPreferencesByUser(user.id),
  ])

  // Read full Supabase User to expose new_email pending state to AccountSection.
  const supabase = await createSupabaseServerClient()
  const { data: { user: fullUser } } = await supabase.auth.getUser()

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 lg:px-8 lg:py-12">
      <h1 className="text-xl font-semibold">Settings</h1>
      <SettingsTabsShell
        username={profile?.username ?? ''}
        displayName={profile?.displayName ?? null}
        avatarUrl={profile?.avatarUrl ?? null}
        currentEmail={user.email}
        pendingNewEmail={fullUser?.new_email ?? null}
        emailChangeSentAt={fullUser?.email_change_sent_at ?? null}
        settings={settings}
        preferences={preferences}
      />
    </main>
  )
}
```

### Email Change Form + Banner (Client Component)

```tsx
'use client'
import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

export function EmailChangeForm({
  currentEmail,
  pendingNewEmail,
}: {
  currentEmail: string
  pendingNewEmail: string | null
}) {
  const [newEmail, setNewEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true); setError(null)
    const supabase = createSupabaseBrowserClient()
    const { error: err } = await supabase.auth.updateUser({ email: newEmail })
    setSubmitting(false)
    if (err) { setError('Could not initiate email change.'); return }
    toast.success('Confirmation emails sent. Check both inboxes.')
    setNewEmail('')
    // pendingNewEmail will populate on next render via Server Component refresh
    // (or use router.refresh() to force).
  }

  return (
    <div>
      {pendingNewEmail && (
        <EmailChangePendingBanner
          oldEmail={currentEmail}
          pendingEmail={pendingNewEmail}
        />
      )}
      <form onSubmit={onSubmit} className="space-y-3">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder={currentEmail}
          autoComplete="email"
          required
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={submitting || !newEmail || newEmail === currentEmail}>
          {submitting ? 'Sending…' : 'Change email'}
        </Button>
      </form>
    </div>
  )
}
```

### Email Change Pending Banner (D-05 + D-06)

```tsx
'use client'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function EmailChangePendingBanner({
  oldEmail,
  pendingEmail,
}: { oldEmail: string; pendingEmail: string }) {
  async function onResend() {
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.updateUser({ email: pendingEmail })
    if (error) { toast.error('Could not resend confirmation.'); return }
    toast.success('Confirmation emails re-sent.')
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
    >
      <p>
        Confirmation sent to <strong>{oldEmail}</strong> and <strong>{pendingEmail}</strong>. Click both links to complete the change.
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2"
        onClick={onResend}
      >
        Resend confirmation
      </Button>
    </div>
  )
}
```

## Critical Discrepancy: D-08 vs Supabase Server-Side Reauth Check

**Locked decision (CONTEXT.md D-08):** "Stale-session detection computes from the JWT `iat` (issued-at) claim on the current `access_token`. Compare `Date.now()/1000 - iat` against `24 * 3600`. Do NOT use `session.created_at` — that field is the original session creation time, not the most recent token refresh, so a session that has been idle-refreshed for days could still appear 'fresh.' The JWT `iat` reflects the most recent refresh, which is the correct freshness signal."

**Supabase server enforcement** ([VERIFIED via GitHub source-read of `supabase/auth/internal/api/user.go`](https://github.com/supabase/auth/blob/master/internal/api/user.go)):
```go
if session == nil || now.After(session.CreatedAt.Add(24*time.Hour)) {
  // require nonce reauthentication
}
```
Supabase compares against `session.CreatedAt` (the `auth.sessions.created_at` column), which is set ONCE at fresh sign-in and does NOT update on token refresh.

**The contradiction in plain terms:**

| Scenario | JWT iat (D-08 signal) | session.CreatedAt (server signal) | D-08 client behavior | Server outcome |
|----------|------------------------|------------------------------------|----------------------|----------------|
| Fresh sign-in 1h ago | iat = 1h ago | CreatedAt = 1h ago | "Fresh, skip dialog" | ✅ Update succeeds |
| Sign-in 7 days ago, token refreshed 5 min ago | iat = 5 min ago | CreatedAt = 7 days ago | "Fresh, skip dialog" | ❌ Server returns "update requires reauthentication" |
| Sign-in 30 hours ago, token refreshed 30 hours ago | iat = 30h ago | CreatedAt = 30h ago | "Stale, open dialog" | ✅ Server requires reauth (matches) |

**Only Scenario 2 misbehaves**, but it is plausibly the most common state for a returning user — the session refreshes silently in the background, the JWT is always young, but the original sign-in is days/weeks/months old. **D-08 will silently fail in this case**, and the user sees "Could not update password" with no actionable next step.

**The closest client-visible proxy to `session.created_at`:** `user.last_sign_in_at` (verified in `node_modules/@supabase/auth-js/dist/module/lib/types.d.ts:358`). It updates on each fresh `signInWithPassword` (and OAuth/OTP/etc. sign-ins) but NOT on token refresh — same semantics as `session.created_at`.

**Recommendations for the planner / discuss-phase to resolve:**

1. **Option A (correct the signal):** Revisit D-08; replace JWT iat with `user.last_sign_in_at`. Decode-free, matches Supabase server enforcement exactly.
2. **Option B (handle server pushback):** Keep D-08's JWT iat client-side check as a soft signal, but ALWAYS catch the 401 from `updateUser({password})` and re-open the re-auth dialog with a clarifying message. Mitigates the silent-failure case at minor UX complexity cost.
3. **Option C (do both):** Use `user.last_sign_in_at` as primary AND catch the 401 as defense in depth.

**The planner cannot resolve this autonomously** — D-08 is a locked decision with explicit rationale. The discuss-phase agent or user must reconcile before the password-change task plan can be finalized.

**Filed as Assumption A1 below.**

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Today's `SettingsClient.tsx` flat list of `<SettingsSection>` cards | Vertical Tabs IA in canonical SaaS order | Phase 22 (this) | Privacy/Notifications migrate; Account becomes real; Profile/Appearance stub |
| `/preferences` as primary Taste Preferences entry point | Preferences tab embed (D-01); `/preferences` becomes redirect (D-15) | Phase 22 | Inverts Phase 14 D-12 |
| `/auth/callback/route.ts` 24-line generic verifier | 5-type switch with redirect map (D-11/D-12) | Phase 22 | Email-change confirmation lands on `/settings#account?status=email_changed`; signup lands with `?status=email_confirmed` |
| Account UI as disabled stubs ("Change Password Coming soon") | Real `updateUser({email})` + `updateUser({password})` flows | Phase 22 | Consumes Phase 21 SMTP foundation |

**Deprecated/outdated in this codebase (ripped out by D-02..D-04):**
- `<SettingsSection title="Collection">` chevron-link to `/preferences` — removed
- `<SettingsSection title="Account">` "Change Password / Blocked Users / Delete Account" disabled-stubs + Delete Account Dialog — removed
- `<SettingsSection title="Appearance">` "Theme — Coming soon" — removed (resurfaces in Phase 23 Appearance tab)
- `<SettingsSection title="Data Preferences">` "Download Data / Export Collection — Coming soon" — removed
- "New Note Visibility" disabled `<Select>` — removed (FEAT-07 ships in Phase 23)

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| **A1** | **D-08 (JWT iat as freshness signal) silently mismatches Supabase server enforcement (which uses `session.created_at`). Recommend reconciling.** | **Critical Discrepancy** | **HIGH — silent password-update failure for users with old sessions and fresh JWTs (the common case for returning users). User-facing symptom: "Could not update password" with no actionable next step.** [VERIFIED via supabase/auth source code; D-08 client signal is verifiable but its server-side counterpart is different] |
| A2 | Sonner `toast.success` from `useEffect` after `useSearchParams` read works without flicker | Pattern 6 | LOW — tested elsewhere in codebase (`WatchSearchRowsAccordion`, `ComposeStep`) [ASSUMED — extrapolation from existing patterns; new on-mount-from-URL trigger is novel here] |
| A3 | base-ui Dialog's portal escapes the Tabs DOM cleanly enough to avoid the `InlineThemeSegmented` Floating UI dismissal pitfall | Pattern 8 / Pitfall 5 | LOW — Dialog is portaled by default; Tabs is not Floating UI [ASSUMED — confirmed structurally; not empirically smoke-tested in this combination yet] |
| A4 | The `/auth/callback` redirect map gracefully handles the deprecated `'email'` alias for `'signup'` (per Supabase docs marking signup/magiclink types as "note: deprecated" but still valid) | Pattern 5 | LOW — coerce `'email' → 'signup'` is the documented behavior in current Supabase docs [CITED: GoTrueClient.d.ts verifyOtp JSDoc]; older email links may still arrive with `type=email` |
| A5 | `getUser()` returning briefly stale state after first email confirmation is acceptable UX (banner copy is forgiving) | Pitfall 4 | LOW — documented in [GitHub #42520](https://github.com/orgs/supabase/discussions/42520); user-visible window is 1–2 seconds [CITED] |
| A6 | RFC 7231 §7.1.2 fragment-preservation behavior is uniformly implemented across Chrome/Safari/Firefox/Edge for the `/preferences → /settings#preferences` redirect | Pattern 7 | LOW — RFC + four major browsers conform per the W3C reference [CITED: https://www.w3.org/People/Bos/redirect]; no known modern browser strips fragments on 3xx |
| A7 | The Settings Server Component's auth gate handles the `next=/settings` round-trip from `/login` correctly when proxy redirects unauth users | Code Examples | LOW — existing pattern verified in `src/app/settings/page.tsx:21` and `src/proxy.ts:13-14` [VERIFIED] |
| A8 | The hashchange listener correctly fires for back/forward navigation when only the hash changes (not pathname) | Pattern 2 | LOW — standard browser behavior; `hashchange` is the canonical event for this [VERIFIED via MDN] |
| A9 | The vertical Tabs roving-focus + ARIA semantics from base-ui satisfy WCAG keyboard-nav requirements out of the box | Standard Stack | LOW — base-ui ships ARIA-correct primitives; existing project usage in ProfileTabs validates [ASSUMED — not explicitly tested in vertical orientation] |

**If this table is empty:** N/A — A1 is a substantive contradiction the planner / discuss-phase MUST address before implementation.

## Open Questions

1. **(BLOCKING for password-change task) D-08 vs Supabase server-side enforcement** — see Critical Discrepancy section. Recommend: discuss-phase reconciles before Plan-XX (password change) is locked. Options A/B/C in Critical Discrepancy.

2. **`/auth/callback` route filename — `callback` vs `confirm`?** SET-06 says `/auth/confirm/route.ts` but the existing file is `src/app/auth/callback/route.ts`. ROADMAP.md success criterion #5 also says `/auth/confirm`. The link emitted in Supabase emails is whatever `Site URL` + the template-defined path — currently this is `/auth/callback`. **Recommend the planner keep `/auth/callback`** (matches existing code + Supabase email templates) and treat the SET-06 `/auth/confirm` mention as a typo. **Verify in Plan**: confirm Supabase Auth template paths match `/auth/callback` (Phase 21 D-08 round-trip already exercised this).

3. **Suspense boundary for `useSearchParams()` consumer** — Settings page is auth-gated and dynamic, so prerender bailout is moot — but does the planner want `<Suspense fallback={null}>` around `<StatusToastHandler />` for hygiene? **Recommend yes**, matches existing pattern in `src/app/search/page.tsx`.

4. **Does the `useTransition` + Server Action pattern apply to email/password change?** Existing `<PrivacyToggleRow>` uses `useOptimistic` + `useTransition` against a Server Action (`updateProfileSettings`). Email/password change calls `supabase.auth.updateUser` directly from the browser client (no Server Action). **Recommend keeping the browser-client direct call** — matches `reset-password-form.tsx`, simpler, no need for SA boundary. Use plain `useState` for loading + error.

5. **Profile tab's `View public profile` Link vs static button** — D-19 says `<Link href="/u/{username}">`. Public profiles require `profile_public = true`; otherwise the link 404s. **Recommend the planner gate the link**: only render if `settings.profilePublic === true`, otherwise show "Profile is private — turn on profile visibility in the Privacy tab to share."

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@base-ui/react` Tabs | SET-01 vertical tabs | ✓ | 1.3.0 | — |
| `@base-ui/react` Dialog | SET-05 re-auth dialog | ✓ | 1.3.0 | — |
| `@supabase/supabase-js` (browser + server) | SET-04 / SET-05 / SET-06 | ✓ | 2.103.0 | — |
| `sonner` toaster | D-13 status toast | ✓ | 2.0.7 mounted at root layout | — |
| Supabase Auth — "Confirm email", "Secure email change", "Secure password change" toggles | All Account flows | ✓ | All ON in prod (Phase 21 D-07 round-trip passed) | — |
| Resend SMTP at `mail.horlo.app` | Email-change confirmation links to BOTH addresses | ✓ | Verified ✓ in Resend (Phase 21) | — |
| `@testing-library/react` 16.3.2 + `vitest` 2.1.9 + `jsdom` 25.0.1 | Wave 0 test scaffolds | ✓ | as in package.json | — |
| `msw` 2.13.2 | Mock Supabase Auth requests in route-handler tests | ✓ | as in package.json | Spy `verifyOtp` on a mock client |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | `vitest` 2.1.9 + `@testing-library/react` 16.3.2 + `jsdom` 25.0.1 (jsdom env) |
| Config file | `/Users/tylerwaneka/Documents/horlo/vitest.config.ts` |
| Quick run command | `npm test -- tests/components/settings tests/app/auth-callback-route.test.ts tests/app/preferences-redirect.test.ts tests/lib/auth/jwtIat.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| **SET-01** | `/settings` renders base-ui vertical Tabs | component (RTL) | `npm test -- tests/components/settings/SettingsTabsShell.test.tsx -t "renders 6 tabs in canonical order with vertical orientation"` | ❌ Wave 0 |
| **SET-02** | Tab change calls `pushState` not `router.push`; `hashchange` updates active tab | component (RTL + history spy) | `npm test -- tests/components/settings/SettingsTabsShell.test.tsx -t "uses pushState"` and `-t "responds to hashchange"` | ❌ Wave 0 |
| **SET-02** | Default-hash redirect: empty `#` → `replaceState('/settings#account')` on mount | component (RTL) | `npm test -- tests/components/settings/SettingsTabsShell.test.tsx -t "default tab is account"` | ❌ Wave 0 |
| **SET-02** | Hash-with-querystring parser: `#account?status=email_changed` resolves to `account` tab + `status=email_changed` | unit | `npm test -- tests/components/settings/SettingsTabsShell.test.tsx -t "parses hash with querystring"` | ❌ Wave 0 |
| **SET-03** | Tabs ordered Account / Profile / Preferences / Privacy / Notifications / Appearance | component | (covered by SET-01 test above) | ❌ Wave 0 |
| **SET-04** | `updateUser({email})` returns `{ user: { new_email } }`; banner gate renders when `user.new_email` is non-null | component (RTL + mock client) | `npm test -- tests/components/settings/EmailChangeForm.test.tsx -t "banner gates on new_email"` | ❌ Wave 0 |
| **SET-04** | Email input keeps showing `user.email` (not `new_email`) during pending state | component | `npm test -- tests/components/settings/EmailChangeForm.test.tsx -t "input shows current email pre-confirmation"` | ❌ Wave 0 |
| **SET-04** | Resend banner action re-fires `updateUser({email})` with same address | component | `npm test -- tests/components/settings/EmailChangePendingBanner.test.tsx -t "resend re-fires updateUser"` | ❌ Wave 0 |
| **SET-04** | Pending banner has `role="status" aria-live="polite"` with locked copy | component | `npm test -- tests/components/settings/EmailChangePendingBanner.test.tsx -t "renders aria-live status"` | ❌ Wave 0 |
| **SET-05** | JWT-iat helper returns `iat` claim from a well-formed token; null on malformed | unit | `npm test -- tests/lib/auth/jwtIat.test.ts` | ❌ Wave 0 |
| **SET-05** | `isSessionStale` returns true for iat > 24h, false for iat < 24h | unit | `npm test -- tests/lib/auth/jwtIat.test.ts -t "stale threshold 24h"` | ❌ Wave 0 |
| **SET-05** | Fresh session (`<24h iat`) → `updateUser({password})` called directly, no dialog | component | `npm test -- tests/components/settings/PasswordChangeForm.test.tsx -t "fresh session updates directly"` | ❌ Wave 0 |
| **SET-05** | Stale session → re-auth dialog opens; on submit calls `signInWithPassword` then `updateUser({password})` | component | `npm test -- tests/components/settings/PasswordReauthDialog.test.tsx -t "stale session re-auth flow"` | ❌ Wave 0 |
| **SET-05** | Re-auth dialog inline error on `signInWithPassword` failure ("Password incorrect") | component | `npm test -- tests/components/settings/PasswordReauthDialog.test.tsx -t "neutral error on signInWithPassword failure"` | ❌ Wave 0 |
| **SET-05** | **(Pending D-08 reconciliation)** If we keep JWT iat AND catch 401 (Option B/C), assert `updateUser({password})` 401 → dialog re-opens | component | `npm test -- tests/components/settings/PasswordChangeForm.test.tsx -t "server 401 reopens dialog"` | ❌ Wave 0 (only if Option B/C selected) |
| **SET-06** | `/auth/callback?type=signup` → `/?status=email_confirmed` | route handler integration | `npm test -- tests/app/auth-callback-route.test.ts -t "signup redirect"` | ❌ Wave 0 |
| **SET-06** | `/auth/callback?type=recovery` → `/reset-password` | route handler | `npm test -- ... -t "recovery redirect"` | ❌ Wave 0 |
| **SET-06** | `/auth/callback?type=email_change` → `/settings#account?status=email_changed` | route handler | `npm test -- ... -t "email_change redirect with hash and status"` | ❌ Wave 0 |
| **SET-06** | `/auth/callback?type=email_change&next=/foo` → still `/settings#account?status=email_changed` (D-12 NEVER override) | route handler | `npm test -- ... -t "email_change ignores next override"` | ❌ Wave 0 |
| **SET-06** | `/auth/callback?type=signup&next=/profile` → `/profile` (D-12 override allowed) | route handler | `npm test -- ... -t "signup honors next override"` | ❌ Wave 0 |
| **SET-06** | `/auth/callback?type=signup&next=//evil.com` → falls back to default (same-origin guard) | route handler | `npm test -- ... -t "signup rejects offsite next"` | ❌ Wave 0 |
| **SET-06** | `/auth/callback?type=magiclink` → `/?status=signed_in`; `?type=invite` → `/signup?status=invited` | route handler | `npm test -- ... -t "magiclink and invite redirects"` | ❌ Wave 0 |
| **SET-06** | `/auth/callback?type=email` (deprecated alias) → coerced to `signup` redirect | route handler | `npm test -- ... -t "email alias coerces to signup"` | ❌ Wave 0 |
| **SET-06** | Unknown / null type → `/login?error=invalid_link` | route handler | `npm test -- ... -t "unknown type falls through to error"` | ❌ Wave 0 |
| **SET-06** | `verifyOtp` returns error → `/login?error=invalid_link` | route handler | `npm test -- ... -t "verifyOtp error falls through"` | ❌ Wave 0 |
| Status toast | `?status=email_changed` on mount fires `toast.success` and strips param **preserving hash** | component | `npm test -- tests/components/settings/StatusToastHandler.test.tsx -t "strips status param preserving hash"` | ❌ Wave 0 |
| `/preferences` redirect | `GET /preferences` → 307 with `Location: /settings#preferences` | route / page | `npm test -- tests/app/preferences-redirect.test.ts -t "redirects with hash preserved"` | ❌ Wave 0 |
| Privacy migration | All 3 `<PrivacyToggleRow>` instances render inside Privacy tab; no functional regression vs existing test | component | `npm test -- tests/components/settings/PrivacySection.test.tsx` | ❌ Wave 0 (extend existing `SettingsClient.test.tsx` to retire its assertions in favor of new tab-based ones) |
| Notifications migration | Both notify toggles render inside Notifications tab | component | `npm test -- tests/components/settings/NotificationsSection.test.tsx` | ❌ Wave 0 |
| Preferences embed | `<PreferencesClient>` renders unchanged inside Preferences tab | component | `npm test -- tests/components/settings/PreferencesSection.test.tsx -t "embeds PreferencesClient unchanged"` | ❌ Wave 0 |
| Profile stub (D-19) | Read-only `displayName`/`username`/avatar render; `<Link>` to `/u/{username}` | component | `npm test -- tests/components/settings/ProfileSection.test.tsx` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `npm test -- tests/components/settings tests/app/auth-callback-route.test.ts tests/app/preferences-redirect.test.ts tests/lib/auth/jwtIat.test.ts` (target: < 30s)
- **Per wave merge:** `npm test` (full suite green)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

All test infrastructure exists; only test files are missing. Wave 0 must scaffold:

- [ ] `tests/components/settings/SettingsTabsShell.test.tsx` — covers SET-01, SET-02, SET-03 + hash parser
- [ ] `tests/components/settings/AccountSection.test.tsx` — top-level integration of email + password forms
- [ ] `tests/components/settings/EmailChangeForm.test.tsx` — covers SET-04 form path
- [ ] `tests/components/settings/EmailChangePendingBanner.test.tsx` — covers SET-04 banner + resend
- [ ] `tests/components/settings/PasswordChangeForm.test.tsx` — covers SET-05 fresh-session direct path + (optional) 401-reopen
- [ ] `tests/components/settings/PasswordReauthDialog.test.tsx` — covers SET-05 stale-session dialog flow
- [ ] `tests/components/settings/StatusToastHandler.test.tsx` — covers D-13 toast + D-14 strip-preserving-hash
- [ ] `tests/components/settings/PrivacySection.test.tsx` — covers D-01 Privacy migration
- [ ] `tests/components/settings/NotificationsSection.test.tsx` — covers D-01 Notifications migration
- [ ] `tests/components/settings/PreferencesSection.test.tsx` — covers D-01 PreferencesClient embed
- [ ] `tests/components/settings/ProfileSection.test.tsx` — covers D-19 stub
- [ ] `tests/app/auth-callback-route.test.ts` — covers SET-06 5-type redirect map + override matrix
- [ ] `tests/app/preferences-redirect.test.ts` — covers D-15 redirect with fragment preserved
- [ ] `tests/lib/auth/jwtIat.test.ts` — covers JWT-iat helper unit tests
- [ ] **Retire** existing `tests/components/settings/SettingsClient.test.tsx` (its assertions about Collection chevron link + Coming-soon stubs become invalid per D-02..D-04). The Server-side `tests/integration/phase13-profile-settings-migration.test.ts` likely keeps its DAL assertions.

**Framework install:** None — already complete.

## Sources

### Primary (HIGH confidence)

- [VERIFIED: code-read of `node_modules/@supabase/auth-js/dist/module/lib/types.d.ts:340-684`] — User interface fields including `new_email`, `email_change_sent_at`, `last_sign_in_at`; EmailOtpType union; UserAttributes `{email, password, current_password, nonce}`
- [VERIFIED: code-read of `node_modules/@supabase/auth-js/dist/module/GoTrueClient.d.ts:1475-1591`] — `updateUser` JSDoc with example response shape including `new_email` and `email_change_sent_at`; reauthentication remarks
- [VERIFIED: code-read of `node_modules/@base-ui/react/tabs/root/TabsRoot.d.ts`] — Tabs.Root props: `value`, `defaultValue`, `orientation`, `onValueChange`
- [VERIFIED: code-read of `node_modules/@base-ui/react/tabs/tab/TabsTab.d.ts`, `panel/TabsPanel.d.ts`] — Tab + Panel props (value-based association)
- [VERIFIED: code-read of `node_modules/next/dist/client/components/redirect.js`] — `redirect(url, type)` packs URL verbatim into error digest; no parsing
- [VERIFIED: code-read of `node_modules/next/dist/server/app-render/app-render.js:4265-4275`] — Server Component redirect path: `setHeader('location', addPathPrefix(url, basePath))`
- [VERIFIED: code-read of `node_modules/next/dist/shared/lib/router/utils/add-path-prefix.js`] — `addPathPrefix` explicitly preserves `hash`
- [VERIFIED: code-read of `node_modules/next/dist/server/app-render/action-handler.js:797-810`] — Server Action redirect path: `res.setHeader('Location', redirectUrl)` verbatim
- [VERIFIED: code-read of existing project files] — `src/app/auth/callback/route.ts`, `src/app/reset-password/reset-password-form.tsx`, `src/app/login/login-form.tsx`, `src/components/ui/tabs.tsx`, `src/components/ui/dialog.tsx`, `src/components/layout/InlineThemeSegmented.tsx`, `src/components/profile/ProfileTabs.tsx`, `src/components/settings/SettingsClient.tsx`, `src/components/preferences/PreferencesClient.tsx`, `src/components/settings/PrivacyToggleRow.tsx`, `src/components/ui/ThemedToaster.tsx`, `src/app/layout.tsx`, `src/lib/auth.ts`, `src/lib/supabase/{client,server}.ts`, `src/data/profiles.ts`
- [VERIFIED: code-read of `supabase/auth/internal/api/user.go` master branch via WebFetch] — `if session == nil || now.After(session.CreatedAt.Add(24*time.Hour))` is the actual server-side reauth check
- [CITED: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`] — `redirect()` accepts relative or absolute paths; throws `NEXT_REDIRECT`
- [CITED: RFC 7231 §7.1.2 + RFC 3986 fragment preservation rules] — Browser MUST honor Location-supplied fragment

### Secondary (MEDIUM confidence — multi-source verified)

- [WebSearch + Supabase docs] — JWT iat is "issued at" Unix timestamp (rotates on token refresh); Supabase JWT claims include session_id, aal, amr (https://supabase.com/docs/guides/auth/jwt-fields)
- [WebSearch + Supabase JS client docs] — `updateUser({email})` sends confirmation links to BOTH old and new addresses when "Secure email change" is ON (https://supabase.com/docs/reference/javascript/auth-updateuser)
- [WebSearch + Supabase community] — `user.new_email` persists until both confirmations land (intentional source of truth); second `updateUser({email})` overwrites pending change (https://github.com/orgs/supabase/discussions/42520)
- [WebSearch + Supabase docs] — "Secure password change" reauthentication threshold is 24 hours (multiple references; https://supabase.com/docs/guides/auth/password-security)

### Tertiary (LOW confidence — flagged for validation)

- [GitHub Discussion #42520] — Brief stale-state window after first email confirmation (Pitfall 4). Acceptable per banner copy forgiveness.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and exercised in codebase; APIs verified against type defs and source code
- Architecture (tabs / hash routing / pending banner / re-auth flow / callback switch / status toast / `/preferences` redirect): HIGH — patterns verified against bundled docs, library source, and existing project usage
- D-08 freshness signal: HIGH on the contradiction itself (Supabase server source code read), MEDIUM on the recommended remediation (multiple options viable)
- Pitfalls: HIGH — primary pitfalls are codebase-evidenced; one pitfall (Floating UI dismissal in Dialog-inside-Tabs) is structurally unlikely but flagged

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (30 days for stable Supabase Auth + Next.js 16.x APIs; if a Supabase Auth or supabase-js major version ships before then, re-verify the User shape and updateUser response)

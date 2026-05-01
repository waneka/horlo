# Phase 22: Settings Restructure + Account Section - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace today's stub `/settings` page (privacy-only with "other sections coming soon") with a `@base-ui/react` **vertical-tabs shell** in canonical SaaS order — Account / Profile / Preferences / Privacy / Notifications / Appearance — and ship the **Account** section's email-change + password-change flows wired to Supabase `auth.updateUser()` with the correct re-auth + dual-confirmation UX. Extend `/auth/callback/route.ts` to switch on `type` (`signup` | `recovery` | `email_change` | `magiclink` | `invite`) with a redirect map, and convert `/preferences` to a redirect to `/settings#preferences`.

The phase ALSO migrates today's working **Privacy** + **Notifications** functionality into their corresponding tabs (zero functional regression) and embeds the existing `PreferencesClient` inside the Preferences tab (so `/preferences` → `/settings#preferences` lands on the same UI users have today). Profile + Appearance tabs ship as "Coming in Phase 23" stubs.

**In scope (SET-01..SET-06):**
1. Vertical-tabs shell with hash-driven routing (`window.history.pushState`, NOT `router.push`).
2. Section order: Account / Profile / Preferences / Privacy / Notifications / Appearance.
3. Account section — email change with persistent inline pending banner; password change with 24h-stale-session re-auth dialog.
4. `/auth/callback/route.ts` extended to a full 5-type switch with redirect map.
5. `/preferences` → `/settings#preferences` redirect (functional content moves into the tab embed).
6. Migration of today's Privacy + Notifications toggles into their respective tabs (no regression).

**Out of scope (Phase 23 owns):** SET-07..SET-12 + FEAT-07/08 — `collectionGoal` / `overlapTolerance` selects, Notifications opt-out toggles styling pass, Privacy restyle pass, Appearance theme switch (lifted from `<InlineThemeSegmented>`), per-note `notesPublic`, `isChronometer` toggle/display.

**Out of scope (other phases own):** UX-06 hybrid toast+banner pattern (Phase 25), branded HTML email templates (SET-14, deferred), `Account → Delete Account / Danger Zone` (SET-13, deferred), Profile tab content beyond stub (no SET-NN owns it; planner discretion below).

</domain>

<decisions>
## Implementation Decisions

### Section Stubbing & Migration Strategy

- **D-01: Migrate today's working Privacy + Notifications + Preferences content into their respective tabs in Phase 22 (no functional regression).** The Privacy tab gets today's three `PrivacyToggleRow` instances (`profilePublic` / `collectionPublic` / `wishlistPublic`) restyled inside the new tab frame. The Notifications tab gets today's two `notifyOnFollow` + `notifyOnWatchOverlap` toggles. The Preferences tab embeds the existing `<PreferencesClient>` from `src/components/preferences/PreferencesClient.tsx` unchanged. **Profile + Appearance tabs ship as "Coming in Phase 23" stub panels** — Profile because no SET-NN defines its content yet (planner discretion below), Appearance because SET-10 (theme switch) belongs to Phase 23.
- **D-02: The today-shipping "Collection → Taste Preferences" link row in `SettingsClient.tsx` is removed.** Users now reach taste preferences via the Preferences tab, not via a chevron-row link. The `/preferences` route still exists but only as a redirect (D-15 below) — there is no longer any UI surface that links to `/preferences` directly.
- **D-03: The today-shipping "Account → Change Password / Blocked Users / Delete Account" stubs in `SettingsClient.tsx` are deleted.** Phase 22's real Account section replaces them. The "Delete Account" Dialog wiring (currently a disabled-button stub) is removed entirely; SET-13 (Danger Zone) is deferred to v5+ per REQUIREMENTS.md.
- **D-04: The today-shipping "Coming soon" stubs ("Theme", "Download Data", "Export Collection", "New Note Visibility" disabled-Select) are removed in Phase 22.** They were stubs from earlier phases that never landed; the new tabs structure makes their "Coming soon" placement awkward. Phase 23 + future phases own each capability (theme → SET-10, note visibility → FEAT-07, data export → out of scope for v4.0).

### Email-Change Pending UX

- **D-05: Pending state lives in a persistent inline banner directly above the email input field in the Account section.** Render as `<div role="status" aria-live="polite">` with the SET-04-locked copy "Confirmation sent to **old@** and **new@**. Click both links to complete the change." The banner persists across page loads — it renders whenever the Supabase user object exposes a non-null `new_email` (Supabase Auth tracks this as `auth.users.email_change_sent_at` + the new address; client gets it via `user.new_email` on the user object returned by `supabase.auth.getUser()`). When the change confirms (both links clicked), `new_email` clears and the banner disappears on next render. The email input field continues to display the **current confirmed email** (the user's primary `email`) until confirmation completes — SET-04 explicitly forbids showing the new email as current pre-confirmation.
- **D-06: The pending banner exposes a single "Resend confirmation" action (no Cancel).** Resend re-fires `supabase.auth.updateUser({ email: newEmail })` which causes Supabase to re-issue both confirmation links. There is no explicit Cancel — if the user wants to revert, they submit a fresh email-change back to their original address (which produces another confirmation pair). Rationale: Cancel-as-a-distinct-action would also fire two emails and adds UI surface; "submit again to a different value" is the simpler mental model and matches Supabase's `email_change` semantics where there is only ever one pending change.
- **D-07: A second email change while the first is still pending is allowed and silently overwrites the first.** Supabase Auth natively replaces `auth.users.email_change` on a second `updateUser({ email })`; the UI just submits and re-renders the banner with the latest target address. No disabled-form state, no "Cancel pending first" guidance. Matches platform behavior; minimal UI complexity.

### Password Change & Re-Auth

- **D-08 (RECONCILED 2026-04-30): Stale-session detection uses `user.last_sign_in_at` as the primary client-side freshness signal AND catches any 401 from `updateUser({ password })` as defense-in-depth.** Read `user.last_sign_in_at` from the `User` object returned by `supabase.auth.getUser()` and compare `Date.now() - new Date(user.last_sign_in_at).getTime()` against `24 * 3600 * 1000`. If exceeded, open the re-auth dialog before calling `updateUser({ password })`. Additionally, ALWAYS wrap `updateUser({ password })` in a try/catch (or check `error?.status === 401` on the response) and on a 401 re-open the re-auth dialog with the same copy. **Why not JWT `iat`:** Verified via supabase/auth source (`internal/api/user.go`) that the server-side reauth check is `session.CreatedAt.Add(24*time.Hour) < now` — `session.created_at` is set once at fresh sign-in and does NOT update on token refresh. JWT `iat` rotates on every silent refresh, so a 7-day-old session with a 5-min-old refreshed JWT would pass a JWT-iat check but be rejected by the server with a 401, producing a silent "Could not update password" failure for the most common returning-user case. `user.last_sign_in_at` is the closest client-visible proxy to `session.created_at` (verified in `@supabase/auth-js/types.d.ts:358`) and updates only on fresh `signInWithPassword` (and OAuth/OTP/etc.), matching server semantics. The 401 catch covers any timing edge cases (e.g., user-record cache lag).
- **D-09: The re-auth dialog asks for current password only (single field).** User is already authenticated; their email is known from `getCurrentUser()`. Dialog flow:
  1. User submits new password + confirm in the Account form.
  2. If session is stale (D-08), open dialog: "Re-enter your password to continue."
  3. On dialog submit, call `supabase.auth.signInWithPassword({ email: currentUserEmail, password })` to refresh the session.
  4. On success, immediately call `supabase.auth.updateUser({ password: newPassword })`.
  5. On either step's failure, surface error inside the dialog (neutral copy: "Password incorrect" — no enumeration concerns since the email is the user's own).
  Single field minimizes friction. Email field is functionally redundant since Supabase binds session to `user.id`.
- **D-10 (RECONCILED 2026-04-30): Fresh sessions (< 24h since `user.last_sign_in_at`) apply password change directly with no re-auth dialog.** Form submits → call `supabase.auth.updateUser({ password })` → success/error surface inline (Sonner toast + inline error per existing `reset-password` pattern). On 401 from `updateUser`, fall back to opening the re-auth dialog (D-08 defense-in-depth). Trust the recent-auth signal; do not require current-password as a UX safety net at fresh sessions. Matches the existing `reset-password-form.tsx` pattern that ships today.

### `/auth/callback` Type-Switched Redirect Map

- **D-11: The callback handles all 5 Supabase `EmailOtpType` values explicitly with a complete redirect map.** Use the `EmailOtpType` import from `@supabase/supabase-js` (already imported today) for type safety. Map:
  | `type` | Default redirect | Notes |
  |--------|------------------|-------|
  | `signup` | `/?status=email_confirmed` | Existing default-`/` behavior, with success status |
  | `recovery` | `/reset-password` (existing flow) | Unchanged from today; `next` may override |
  | `email_change` | `/settings#account?status=email_changed` | **SET-06 spec; NEVER overridable** by `next` |
  | `magiclink` | `/?status=signed_in` | Future-ready; horlo doesn't expose magic-link signin yet but this future-proofs the route |
  | `invite` | `/signup?status=invited` | Dormant flow; map exists for completeness |
  Unknown / null `type` falls through to today's behavior: `/login?error=invalid_link`.
- **D-12: The `next` query param overrides the type-default redirect ONLY for `signup`, `recovery`, and `magiclink`.** For `email_change`, the destination is **always** `/settings#account?status=email_changed` regardless of any `next` value carried in the link. For `invite`, the type-default wins (invite is dormant; no `next` flow exists). The same-origin/relative-path guard from today's route (`safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/'`) is preserved. Rationale: `email_change` confirmation links could carry a stale `next` param from when the user first hit the change form; honoring it post-confirm could send them somewhere confusing. The success location is part of the spec.
- **D-13: Success status surfaces via URL `?status=` query param + a one-shot Sonner toast.** Each destination page renders a small Client Component (or an existing one if appropriate, e.g., `SettingsClient` for `/settings#account?status=email_changed`) that:
  1. Reads `useSearchParams()` for `status`.
  2. Fires a Sonner toast on the matching value (e.g., `email_changed` → `toast.success('Email changed successfully')`).
  3. Strips the `status` param via `router.replace(pathname + (currentHash ?? ''))` so a page reload doesn't re-fire the toast.
  Use existing `<ThemedToaster />` (Phase 15) — already mounted at root layout. **Do NOT add the inline `aria-live` banner here** — UX-06 (Phase 25) ships the hybrid toast+banner pattern across all Server Action surfaces; this phase uses toast-only to stay scoped. Phase 25 will retroactively add the banner if the hybrid is required at this surface.
- **D-14: For `/settings#account?status=email_changed`, preserve the hash through the `router.replace` strip.** Naïve `router.replace(pathname)` would drop the `#account` fragment; users would land on the default tab (Account in canonical order, but if the default-tab logic ever changes that breaks). Use `router.replace(pathname + window.location.hash)` or equivalent. This is a known footgun documented inline.

### `/preferences` Redirect

- **D-15: Convert `/preferences/page.tsx` to a server-side `redirect('/settings')` followed by a tiny client-side mount that sets `window.location.hash = '#preferences'` on the destination.** Next.js `redirect()` cannot preserve a URL fragment because the fragment is never sent to the server in the first place. Approach:
  1. `/preferences/page.tsx` becomes `import { redirect } from 'next/navigation'; export default function() { redirect('/settings#preferences') }` — the `#preferences` is a literal in the redirect string. Browsers DO honor fragment in `Location:` headers on 3xx redirects (per RFC 7231 §7.1.2), and Next.js `redirect()` produces a 307 with the full Location including the fragment.
  2. The Settings page's tab routing logic reads `window.location.hash` on mount (per SET-02) and selects the matching tab — `#preferences` resolves to the Preferences tab automatically.
  3. **Verify in Plan**: confirm Next.js 16's `redirect()` preserves the `#fragment` portion of the redirect target in production. If it doesn't (some redirect implementations strip fragments), fall back to a small Client Component `useEffect(() => { window.location.replace('/settings#preferences') }, [])` pattern.

### Hash-Driven Tab Routing (Implementation Notes — Claude's Discretion)

- **D-16: Hash format is `#tab` for the basic case and `#tab?key=value` for status-carrying links** (e.g., `#account?status=email_changed` per SET-06). Parser: `const [tab, query] = hash.slice(1).split('?', 2); const params = new URLSearchParams(query ?? '')`. The non-standard hash-with-querystring shape is mandated by SET-06 — it's how the auth callback success URL is structured. Document inline since this isn't a standard URL pattern.
- **D-17: Default tab if no hash is `#account` (the first canonical tab).** First-time visits to `/settings` show the Account section. The hash is set via `window.history.replaceState(null, '', '/settings#account')` on mount if no hash is present, so the URL stays clean and shareable.
- **D-18: A `hashchange` event listener handles browser back/forward navigation between tabs.** Without it, `pushState` updates the URL but back-button presses don't update the active tab. The listener calls the same parser as the on-mount read.

### Profile Tab Content (Claude's Discretion)

- **No SET-NN requirement defines the Profile tab's content in v4.0.** Phase 25 mentions UX-08 ("profile edit form fires success toast on save") which implies a profile-edit surface exists somewhere, but it is not scoped to this phase. **Recommended stub for Phase 22:** Profile tab renders a simple panel with the user's current `displayName` / `username` / avatar (read-only display from `getProfileById`) plus a `<Link href="/u/{username}">View public profile</Link>` button and a "Profile editing coming soon" note. This avoids scope creep and gives users a meaningful (non-empty) Profile tab. Phase 25 (or whichever phase owns UX-08) replaces the read-only panel with the edit form.

### Folded Todos

None — `todo match-phase 22` returned zero matches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-Level
- `.planning/PROJECT.md` Key Decisions table — `Email confirmation OFF → ON` row (Phase 21 result this phase consumes), Cache Components inline-theme-script pattern, two-layer privacy doctrine.
- `.planning/REQUIREMENTS.md` § "Settings Restructure" lines 73–86 — SET-01 through SET-12 acceptance criteria; this phase ships SET-01..SET-06 only.
- `.planning/REQUIREMENTS.md` § "Email / Custom SMTP" lines 88–97 — SMTP foundation this phase consumes (SMTP-03 / SMTP-04 toggles already ON in prod).
- `.planning/ROADMAP.md` § "Phase 22: Settings Restructure + Account Section" lines ~200–211 — Goal, dependencies, 5 success criteria.
- `.planning/STATE.md` — current v4.0 milestone status; project ref `wdntzsckjaoqodsyscns`.

### Prior-Phase Artifacts (dependency chain)
- `.planning/phases/21-custom-smtp-via-resend/21-CONTEXT.md` — D-07 round-trip gate (passed); D-10 signup-form `{ session: null }` handling (already shipped); confirms SMTP delivery is verified for the email-change flow this phase ships.
- `.planning/phases/18-explore-discovery-surface/18-CONTEXT.md` D-03 — Profile permanent in BottomNav (informs Profile tab placement decision in D-19).
- `.planning/phases/14-...-CONTEXT.md` D-12 — `/preferences` is sole v3.0 entry point for taste preferences (this phase inverts that — Preferences tab becomes the primary surface; `/preferences` becomes a redirect).

### Code Patterns to Mirror
- `src/app/auth/callback/route.ts` — current implementation (24-line route; this phase extends to ~80 lines with the type switch + redirect map).
- `src/app/reset-password/reset-password-form.tsx` — direct template for password-change form pattern (`updateUser({ password })`, error handling, loading state, `autoComplete="new-password"`).
- `src/app/login/login-form.tsx` — direct template for re-auth dialog content (`signInWithPassword({ email, password })`, neutral error copy, loading state).
- `src/components/settings/SettingsClient.tsx` — current Privacy + Notifications wiring (`<PrivacyToggleRow>` field + initialValue pattern); migrate intact into the new tab structure.
- `src/components/settings/SettingsSection.tsx` — heading + card frame; reusable inside each tab panel.
- `src/components/preferences/PreferencesClient.tsx` — embed unchanged inside the Preferences tab (D-01).
- `src/components/ui/tabs.tsx` — base-ui Tabs wrapper already supports `orientation="vertical"` via `data-orientation` attribute and the `group-data-vertical` Tailwind class set; reuse this primitive, do not fork.
- `src/components/layout/InlineThemeSegmented.tsx` — `e.stopPropagation()` + `onPointerDown/Up stopPointer` pattern that defends against base-ui Floating UI dismissal swallowing clicks; **the same gotcha applies to any base-ui-Dialog-inside-Tabs**, watch for it in the re-auth dialog.
- `src/components/ui/dialog.tsx` — base-ui Dialog wrapper for the re-auth dialog (D-09).
- `src/components/ui/ThemedToaster.tsx` — Sonner toaster bound to custom ThemeProvider (D-13 success-status toasts use this).
- `src/lib/supabase/server.ts` + `src/lib/supabase/client.ts` — server-side and browser-side Supabase client factories; auth-callback route uses server, Account section uses both (server for initial read, browser for `updateUser` mutations).
- `src/lib/auth.ts` — `getCurrentUser()` + `UnauthorizedError` pattern; Settings page uses the same redirect-on-unauth flow as today.

### Schema / Data Sources
- Supabase `auth.users` table — Phase 22 reads `email`, `email_change` (the pending new address), `email_change_sent_at`, and the JWT issued-at via `getSession()`. **No application schema changes** in this phase.
- Supabase Dashboard — Auth settings are already wired correctly per Phase 21 (Confirm email + Secure email change + Secure password change all ON; Resend SMTP at `mail.horlo.app`). No dashboard changes in this phase.

### External (Vendor) Docs — Read at Research-Phase
- Supabase Auth `updateUser` (email + password): https://supabase.com/docs/reference/javascript/auth-updateuser
- Supabase Auth email change flow: https://supabase.com/docs/guides/auth/auth-email#email-change
- Supabase Auth `verifyOtp` for callback: https://supabase.com/docs/reference/javascript/auth-verifyotp
- Supabase Auth secure password change / reauthentication thresholds: https://supabase.com/docs/guides/auth/passwords#secure-password-change
- Supabase Auth `EmailOtpType` (TypeScript type ref): `node_modules/@supabase/auth-js/dist/module/lib/types.d.ts` — `EmailOtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email'`
- Base UI Tabs (vertical orientation + roving focus): https://base-ui.com/react/components/tabs
- RFC 7231 §7.1.2 (URL fragments preserved through 3xx redirects): https://datatracker.ietf.org/doc/html/rfc7231#section-7.1.2

### Memory References
- `~/.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_drizzle_supabase_db_mismatch.md` — DB migration rules (not directly invoked; no schema changes this phase).
- `~/.claude/projects/-Users-tylerwaneka-Documents-horlo/memory/project_supabase_secdef_grants.md` — SECDEF grant rules (not directly invoked; no SECDEF functions added this phase).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets

- **`/auth/callback/route.ts`** — Current 24-line route already validates `safeNext`, calls `verifyOtp({ type, token_hash })`, handles success + error redirect. Phase 22 extends this with the D-11 type-switch dispatch table. The existing same-origin guard stays intact.
- **`<PrivacyToggleRow>`** (referenced in `SettingsClient.tsx`) — Pure migration target into the Privacy tab. The `field` + `initialValue` props are already framework-aligned with how Server Actions update `profile_settings`. No changes required.
- **`<PreferencesClient>`** (`src/components/preferences/PreferencesClient.tsx`) — Embeds verbatim into the Preferences tab. Already a Client Component with `useTransition` + Server Action wiring (`savePreferences`). Currently rendered inside `/preferences/page.tsx` which is the only thing that needs to change (D-15: page becomes a redirect; component re-mounts inside the Settings tab).
- **`<SettingsSection>`** (`src/components/settings/SettingsSection.tsx`) — Heading + card frame; reused inside each tab panel for visual consistency.
- **`<Dialog>`** (`src/components/ui/dialog.tsx`) — base-ui dialog wrapper; used for the re-auth dialog in D-09. Already used in today's `SettingsClient` for the (deleted) Delete Account dialog.
- **`<ThemedToaster />`** (Phase 15, `src/components/ui/ThemedToaster.tsx`) — Sonner toaster bound to custom ThemeProvider. Already mounted at root layout. D-13 success toasts call `toast.success('...')` with no additional setup.
- **`reset-password-form.tsx`** — Direct template for the password-change form pattern (loading state, error inline, `updateUser({ password })`).
- **`login-form.tsx`** — Direct template for the re-auth dialog form pattern (`signInWithPassword`, neutral error, autoComplete).
- **`getCurrentUser()` + `UnauthorizedError`** (`src/lib/auth.ts`) — Settings page already uses this pattern; Account section additions reuse it for the user.email source.
- **`createSupabaseBrowserClient()`** (`src/lib/supabase/client.ts`) — Account section's email + password mutations call this to get a browser-scoped Supabase client (matches the reset-password and login form patterns).

### Established Patterns

- **`'use client'` Client Components for stateful UI** — Tabs, dialogs, hash routing all need to be in Client Components. The `/settings/page.tsx` Server Component fetches user + profile + settings, then hands them off to the Client Component shell.
- **Hash routing via `window.history.pushState` + `hashchange` listener** — D-16/D-17/D-18 establish this pattern fresh in this codebase. Ref: `useSearchState` (Phase 16) is the closest analogue but uses `useSearchParams()` from Next.js — different shape, but similar "URL-as-state" mental model.
- **Server-side `redirect()` preserves URL fragment in 3xx Location header** (D-15) — Verify in Plan; Next.js 16 default behavior should match RFC 7231.
- **Sonner toast + URL `?status=` strip-on-mount pattern** (D-13) — New pattern in this codebase. Phase 25 UX-06 will generalize this with the toast+banner hybrid; Phase 22 establishes the toast-only baseline.
- **JWT decode for `iat` claim** (D-08) — New pattern. Use `atob(token.split('.')[1])` + `JSON.parse` (browser-safe; no jose / jwt-decode dependency needed for read-only `iat`).
- **base-ui Floating UI dismissal interaction with nested clickables** — `InlineThemeSegmented.tsx` documents the `e.stopPropagation()` + `onPointerDown/Up stopPointer` workaround. The re-auth dialog (a base-ui Dialog) sits inside the Tabs (also base-ui) — watch for the same pattern.

### Integration Points

- **`src/app/settings/page.tsx`** — Rewritten. Today fetches profile + settings and renders `<SettingsClient>`. New shape: fetches profile + settings + user (already does via getCurrentUser), passes everything down to a new `<SettingsTabsShell>` Client Component that renders the 6 tabs. The `mx-auto max-w-2xl px-4 py-8 lg:px-8 lg:py-12` page wrapper stays.
- **`src/app/preferences/page.tsx`** — Rewritten as a server redirect to `/settings#preferences` per D-15.
- **`src/app/auth/callback/route.ts`** — Extended per D-11/D-12 with the type-switch + per-type redirect map. The same-origin guard on `next` is preserved but only consulted for the 3 override-eligible types (D-12).
- **`src/components/settings/SettingsClient.tsx`** — Disassembled. Privacy section content + Notifications section content move into their respective tab panels (or are extracted into `<PrivacySection>` + `<NotificationsSection>` sub-components owned by the new tabs shell). The Collection chevron link, Account stubs, Delete Account dialog, Coming-soon stubs, and "New Note Visibility" disabled control are deleted (D-02 / D-03 / D-04).
- **New components (illustrative — planner's call on naming/factoring):**
  - `src/components/settings/SettingsTabsShell.tsx` — Client Component; renders the base-ui Tabs with vertical orientation; reads/writes `window.location.hash` per D-16/D-17/D-18.
  - `src/components/settings/AccountSection.tsx` — Email change form + password change form + re-auth dialog + pending-banner.
  - `src/components/settings/ProfileSection.tsx` — D-19 stub (read-only display + "View public profile" link).
  - `src/components/settings/PrivacySection.tsx` — Migrated `PrivacyToggleRow` set.
  - `src/components/settings/NotificationsSection.tsx` — Migrated `notifyOnFollow` + `notifyOnWatchOverlap` toggles.
  - `src/components/settings/PreferencesSection.tsx` — Wraps embedded `<PreferencesClient>`.
  - `src/components/settings/AppearanceSection.tsx` — "Coming in Phase 23" stub.
  - `src/components/settings/EmailChangePendingBanner.tsx` — D-05 inline banner with "Resend confirmation" action.
  - `src/components/settings/PasswordReauthDialog.tsx` — D-09 single-field re-auth modal.
  - `src/lib/auth/jwt-iat.ts` — D-08 helper to extract `iat` from the access token.
- **No DAL changes required** — Account section talks directly to Supabase Auth via `supabase.auth.updateUser()` and `supabase.auth.getUser()`. Profile + Privacy + Notifications already have DAL wiring from earlier phases.
- **No schema changes required** — All Account state lives in Supabase `auth.users`. Phase 22 has zero migration files.

</code_context>

<specifics>
## Specific Ideas

- **The Account section is the "real" thing in this phase; everything else is shell + migration.** Plan effort accordingly: Account UI surface (form + banner + dialog + JWT-iat helper + Sonner status toast) is roughly 60% of the implementation; the Tabs shell + hash routing is ~25%; the auth-callback type switch is ~10%; the `/preferences` redirect is ~5%.
- **Hash-with-querystring is intentionally non-standard** (D-16). The format `#account?status=email_changed` is mandated by SET-06 — it's how the auth callback's success URL is structured. Document the parser inline.
- **Email-change banner persists across reloads** (D-05). The state lives in Supabase (`auth.users.email_change` column); the UI just renders whatever the latest `getUser()` returns. If the user closes the tab mid-pending and comes back days later, the banner is still there until both confirmation links are clicked or the change is overwritten by a new one.
- **JWT `iat` not `session.created_at` for staleness** (D-08). This is a real footgun — a session that's been silently refreshed for a week has a 30-second-old `iat` but a 7-day-old `created_at`. The 24h re-auth threshold is only meaningful if measured against the most recent token refresh.
- **Email-change confirmation is NEVER `next`-overridable** (D-12). The success URL is part of the spec.
- **The re-auth dialog is base-ui Dialog inside base-ui Tabs** — watch the `InlineThemeSegmented` Floating UI dismissal pitfall (`e.stopPropagation()` + `onPointerDown/Up stopPointer` workaround documented in that file).
- **Verify in Plan: Next.js 16 `redirect()` preserves URL fragments** (D-15). RFC says yes; framework should comply, but verify in the plan with a quick test before relying on it. Fallback to a Client Component `useEffect` redirect if not.

</specifics>

<deferred>
## Deferred Ideas

- **SET-07 / SET-08 (collectionGoal + overlapTolerance selects)** — Phase 23 owns. The Preferences tab in Phase 22 embeds today's `<PreferencesClient>` which already exposes related controls; Phase 23 enriches/restyles.
- **SET-09 (Notifications opt-out toggle styling pass)** — Phase 23 restyles the notifications toggles into the new tab frame. Phase 22 ships the toggles functionally migrated but not visually polished.
- **SET-10 (Appearance theme switch lifted from `<InlineThemeSegmented>`)** — Phase 23 owns. Phase 22 ships an "Appearance — Coming in Phase 23" stub.
- **SET-11 (Privacy restyle pass)** — Phase 23 owns. Phase 22 ships the privacy toggles functionally migrated.
- **FEAT-07 / FEAT-08 (per-note `notesPublic`, `isChronometer` toggle/display)** — Phase 23 owns; lives outside Settings (in WatchForm / WatchDetail).
- **UX-06 hybrid Sonner-toast + `aria-live` banner pattern** — Phase 25 ships this across all Server Action surfaces. Phase 22 D-13 uses toast-only; Phase 25 will retroactively enrich if needed.
- **SET-13 (Account → Delete Account / Danger Zone)** — Already deferred to v5+ per REQUIREMENTS.md. Phase 22 deletes today's stub Delete Account dialog (D-03); the whole Danger Zone reappears in v5+.
- **SET-14 (Branded HTML email templates)** — Already deferred per REQUIREMENTS.md / Phase 21 D-Discretion. Phase 22 uses Supabase defaults for the email-change confirmation emails.
- **Supabase `auth.reauthenticate()` nonce flow** — Considered for password re-auth (D-09 alternative). Rejected for Phase 22: adds a Resend round-trip, blocks the user on inbox latency. The current-password approach is sufficient for v4.0 personal-MVP threat model.
- **Magic-link signin flow** — D-11 maps `magiclink → /?status=signed_in` for future-proofing, but no UI exposes a magic-link signin path in v4.0. Activating it is a separate phase.
- **Invite flow** — D-11 maps `invite → /signup?status=invited`, but horlo doesn't expose invitations. Map exists for completeness; activation is a future feature.
- **Profile tab editing** — D-19 ships a read-only stub. The actual profile-edit form (UX-08 success toast) lands in Phase 25 or whichever phase owns the edit surface; that phase replaces the read-only panel.

### Reviewed Todos (not folded)

None — `todo match-phase 22` returned zero matches.

</deferred>

---

*Phase: 22-settings-restructure-account-section*
*Context gathered: 2026-04-30*

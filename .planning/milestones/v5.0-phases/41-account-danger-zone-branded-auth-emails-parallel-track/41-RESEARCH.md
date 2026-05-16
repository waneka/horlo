# Phase 41: Account Danger Zone + Branded Auth Emails - Research

**Researched:** 2026-05-15
**Domain:** Supabase service-role admin operations, Storage object purge, FK cascade analysis, react-email static HTML authoring
**Confidence:** HIGH (codebase findings verified directly; react-email/Supabase docs cross-checked against official sources)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Two separate modal components — `WipeCollectionModal` and `DeleteAccountModal`. Not a shared parametrized component.
- **D-02:** Step flow for both modals: **Warn → (type-to-confirm input + password field on one combined step) → execute.** Step 1 = warning screen listing exactly what gets destroyed. Step 2 = combined type-to-confirm + current-password field. Then execute.
- **D-03:** Password re-auth is a **new inline step inside each Danger Zone modal**, reusing the Phase 22 `PasswordReauthDialog` *pattern* (`signInWithPassword({ email, password })` session-refresh logic) — NOT reusing the component itself.
- **D-04:** Fixed keyword per action — type `WIPE` for Wipe Collection, `DELETE` for Delete Account.
- **D-05:** Execute button stays **disabled until typed text matches keyword exactly**. No inline mismatch error state.
- **D-06:** After Wipe succeeds: close modal, fire Sonner success toast, stay on `/settings` Account tab.
- **D-07:** After Delete Account succeeds: sign user out, redirect to marketing landing `/`. No new route.
- **D-08:** `notifications.actor_id` cascade documented in CONTEXT.md UX Note. **No mention in modal UI.**
- **D-09:** react-email source files live in a **top-level `emails/` directory at repo root**, build-excluded (NOT under `src/`).
- **D-10:** Email header is a **styled "Horlo" text wordmark** in brand color — NOT a hosted `<img>` logo.
- **D-11:** Brand color matches `--accent: oklch(0.76 0.12 75)` from `src/app/globals.css` — but email HTML must use a hex/rgb fallback (no `oklch()`).
- **D-12:** CTA button copy is action-specific: "Confirm your email" / "Reset your password" / "Confirm email change".

### Claude's Discretion
- Exact warning-screen copy listing what gets destroyed (within D-02 structure).
- Exact toast wording for the Wipe success path (D-06).
- Email body copy and visual polish (within 600px single-column, wordmark header, single CTA).
- Service-role Supabase client construction approach — no service-role/admin client exists in `src/lib/supabase/` today.

### Deferred Ideas (OUT OF SCOPE)
- Hosted image logo for emails (revisit when a logo asset exists).
- Account-delete cascade warning copy in modal UI (revisit when a 2nd user exists).
- Grace period / soft-delete for Delete Account (explicitly out of scope per SET-13).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SET-13 | Account → Danger Zone with two actions (Wipe Collection / Delete Account); type-to-confirm + password re-auth + multi-step modal; storage purged before DB delete; `notifications.actor_id` cascade documented | §Standard Stack (service-role client), §Architecture Patterns (server actions), §Runtime State Inventory (FK cascade map — the critical finding is `public.users` has NO FK to `auth.users`), §Common Pitfalls (storage purge, cascade gap) |
| SET-14 | Three rebranded Supabase Auth email templates (Confirm signup / Reset Password / Change Email): 600px single-column, brand color, single CTA; built with react-email; cross-client verified; HTML pasted into Supabase dashboard; no Next.js code change | §Standard Stack (react-email), §Architecture Patterns (`emails/` dir), §Code Examples (Supabase template variables, email layout), §Common Pitfalls (oklch, Outlook MSO, dark mode) |
</phase_requirements>

## Summary

Phase 41 ships two fully independent deliverables. **Track A (SET-13)** is server-action + modal-UI work; **Track B (SET-14)** is static HTML authoring that ships zero app code. They share no code and can be planned/executed in parallel waves.

The single most important finding for Track A: **`public.users` is a standalone shadow table with NO foreign key to `auth.users`.** It is populated by the `on_auth_user_created` AFTER-INSERT trigger (`supabase/migrations/20260413000000_sync_auth_users.sql`). Therefore `supabase.auth.admin.deleteUser()` deletes the `auth.users` row but **does NOT cascade to `public.users`** — and consequently does NOT cascade to `watches`, `wear_events`, `profiles`, `follows`, `notifications`, `user_preferences`, `profile_settings`, or `activities`, all of which FK to `public.users` (not `auth.users`). The Delete Account server action MUST explicitly delete the `public.users` row (or its dependents) itself. The one exception: `divestments` FKs directly to `auth.users(id) ON DELETE CASCADE` (per `supabase/migrations/20260511010000_phase37_layer_d.sql`), so divestments DO auto-purge when the auth user is deleted.

For Track B, `react-email` is a CLI + component library that authors React components and exports them to static, inlined HTML via `npx react-email export`. The latest published versions are `react-email` **6.1.4** and `@react-email/components` **1.0.12** (verified via npm registry 2026-05-15). The CONTEXT/REQUIREMENTS reference to "react-email 6.1.1" is a valid older pin in the 6.x line — planner should decide whether to pin 6.1.1 exactly or take 6.1.4. Email HTML cannot use `oklch()`; the accent must be converted to a hex fallback.

**Primary recommendation:** Track A — build a new `src/lib/supabase/admin.ts` service-role client (created per-call, never cached, `import 'server-only'`), and TWO new server actions (`wipeCollection`, `deleteAccount`) that purge `wear-photos/{userId}/` storage objects BEFORE any DB delete, then delete DB rows in FK-safe order (or rely on `public.users` cascade). Track B — scaffold a build-excluded `emails/` directory at repo root with three react-email templates sharing a layout component, export via `npx react-email export`, paste HTML into the Supabase Auth dashboard.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Danger Zone modal UI (warn → confirm → execute) | Browser / Client (`'use client'`) | — | Multi-step state, type-to-confirm input, password field — all client interaction; mounts in `AccountSection.tsx` |
| Password re-auth (`signInWithPassword`) | Browser / Client | — | Per D-03/Phase 22 pattern — runs on the browser Supabase client to refresh the session before the destructive call |
| Wipe Collection (DB rows + storage purge) | API / Backend (server action) | Database / Storage | Deletes `watches` + `wear_events` rows + `wear-photos/{userId}/` objects; uses session-scoped server client (anon + RLS sufficient — caller owns the rows) |
| Delete Account (full hard delete) | API / Backend (server action) | Database / Storage / Auth | Requires the **service-role** key for `auth.admin.deleteUser()` — anon key cannot call admin APIs |
| Auth email templates | CDN / Static (HTML pasted into Supabase dashboard) | — | Zero app code; HTML lives in Supabase Auth config, rendered by Supabase's GoTrue mailer |
| react-email source authoring | Build tooling (dev-only, build-excluded) | — | `emails/` dir at repo root never enters the Next.js build per D-09 |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@supabase/supabase-js` | `^2.103.0` (already installed) | Service-role admin client (`createClient` + `auth.admin.deleteUser()`); Storage `.list()` / `.remove()` | Already a project dependency; `createClient` from the base SDK is the correct entry for a non-SSR service-role client (NOT `@supabase/ssr` — that is for cookie-bound user sessions) |
| `react-email` | `6.1.4` latest (`6.1.1` referenced in SET-14 — valid 6.x pin) | CLI: `dev` (preview server), `export` (render to static HTML) | The de-facto standard for authoring HTML email in React; export produces inlined, client-safe HTML |
| `@react-email/components` | `1.0.12` latest | `<Html>`, `<Head>`, `<Body>`, `<Container>`, `<Section>`, `<Text>`, `<Button>`, `<Heading>`, `<Hr>` | Pre-built primitives that render cross-client-safe HTML (table-based layout, MSO conditionals handled internally for `<Button>`) |

**Version verification (npm registry, 2026-05-15):**
- `react-email` — latest `6.1.4`; dist-tags: `latest: 6.1.4`, `previous: 5.2.11`. `6.1.1` is a valid prior 6.x release. `[VERIFIED: npm view react-email]`
- `@react-email/components` — latest `1.0.12`. `[VERIFIED: npm view @react-email/components]`
- `@react-email/render` — latest `2.0.8` (only needed if rendering programmatically instead of via CLI export — NOT required for D-09 CLI flow). `[VERIFIED: npm view @react-email/render]`

> **Planner decision needed:** SET-14 says "react-email 6.1.1". The npm latest is 6.1.4. Recommend pinning whichever the planner prefers — patch-level drift within 6.x is low-risk. The `@react-email/components` version (`^1.0.12`) is the load-bearing one for the primitive APIs; SET-14's "6.1.1" refers to the CLI package, not components. `[ASSUMED]` — the "6.1.1" in SET-14 is the CLI version label.

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `sonner` | `^2.0.7` (already installed) | Success toast after Wipe (D-06) | Established project pattern — `toast.success()` via `useFormFeedback` |
| `react-dom` | `19.2.4` (already installed) | react-email peer dep | react-email components are React components; no extra install |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `react-email` CLI export | Hand-written HTML email | Hand-writing table-based, MSO-conditional, inline-styled email HTML is error-prone; react-email gives a committed React source of truth (D-09 explicitly chooses react-email) |
| New `src/lib/supabase/admin.ts` | Extending `server.ts` with a service-role variant | Keep them separate — `server.ts` is cookie/RLS-bound (`@supabase/ssr`); the admin client is a different security posture (bypasses RLS) and must be unmistakably isolated. New file is correct. |
| `@react-email/render` programmatic render | `npx react-email export` CLI | D-09 mandates `emails/` is build-excluded with no app wiring — the CLI export path produces static HTML files with zero runtime coupling. `render()` would imply runtime usage. Use the CLI. |

**Installation:**

```bash
# Track B only — devDependencies (emails/ is build-excluded, never shipped)
npm install --save-dev react-email @react-email/components

# Track A needs nothing new — @supabase/supabase-js ^2.103.0 already installed
```

> `react-email` + `@react-email/components` belong in **devDependencies** — they are dev tooling for authoring email HTML, never imported by the Next.js app (D-09).

## Architecture Patterns

### System Architecture Diagram

```
TRACK A — Danger Zone
=====================

  /settings#account  (AccountSection.tsx, Server Component)
        │
        ├── EmailChangeForm        (existing, Phase 22)
        ├── PasswordChangeForm     (existing, Phase 22)
        └── DangerZoneSection      (NEW — 'use client' or composes 2 client modals)
                │
                ├──> WipeCollectionModal ('use client')
                │       step 1: Warn screen (lists destroyed items)
                │       step 2: type "WIPE" + current-password field
                │       └─ on execute:
                │            browser supabase.auth.signInWithPassword(email,pwd)  ── re-auth (D-03)
                │            └─ server action: wipeCollection()
                │                 ├─ purge wear-photos/{userId}/ storage objects
                │                 └─ delete wear_events + watches rows (caller-scoped, RLS-safe)
                │            └─ Sonner toast + stay on Account tab (D-06)
                │
                └──> DeleteAccountModal ('use client')
                        step 1: Warn screen
                        step 2: type "DELETE" + current-password field
                        └─ on execute:
                             browser supabase.auth.signInWithPassword(email,pwd)  ── re-auth (D-03)
                             └─ server action: deleteAccount()
                                  ├─ [1] purge wear-photos/{userId}/ storage objects   ← BEFORE db delete
                                  ├─ [2] delete public.users row  (cascades to all FK children)
                                  │      OR auth.admin.deleteUser() then explicit public.users delete
                                  └─ [3] auth.admin.deleteUser()   ← needs SERVICE-ROLE client
                             └─ browser supabase.auth.signOut() + redirect "/" (D-07)


TRACK B — Branded Auth Emails  (zero app code)
==============================================

  emails/  (repo root, build-excluded)
   ├── components/HorloEmailLayout.tsx   (shared: wordmark header, 600px container, footer)
   ├── confirm-signup.tsx
   ├── reset-password.tsx
   └── change-email.tsx
        │
        │  npx react-email export   (dev-time only)
        ▼
   emails/out/*.html   (static, inlined HTML)
        │
        │  manual copy-paste (operator step)
        ▼
   Supabase Dashboard → Authentication → Email Templates
   (Confirm signup / Reset Password / Change Email)
        │
        ▼
   GoTrue mailer renders {{ .ConfirmationURL }} etc. → sends via Resend SMTP @ mail.horlo.app
```

### Recommended Project Structure

```
src/lib/supabase/
├── client.ts          # existing — browser, anon
├── server.ts          # existing — server, anon, cookie-bound
├── proxy.ts           # existing
└── admin.ts           # NEW — service-role client; import 'server-only'

src/app/actions/
├── ...existing...
└── account.ts         # NEW — wipeCollection() + deleteAccount() server actions

src/components/settings/
├── AccountSection.tsx       # MODIFIED — append <DangerZoneSection/>
├── DangerZoneSection.tsx    # NEW — composes the two modals + trigger buttons
├── WipeCollectionModal.tsx  # NEW — 'use client', 2-step
└── DeleteAccountModal.tsx   # NEW — 'use client', 2-step

emails/                      # NEW — repo ROOT, build-excluded (D-09)
├── components/
│   └── HorloEmailLayout.tsx
├── confirm-signup.tsx
├── reset-password.tsx
└── change-email.tsx
```

### Pattern 1: Service-role Supabase admin client

**What:** A Supabase client created with the service-role key that bypasses RLS and can call `auth.admin.*` APIs.
**When to use:** Server-side only, for `auth.admin.deleteUser()`. NEVER on the client, NEVER in a Server Component that renders to the browser.
**Example:**

```typescript
// src/lib/supabase/admin.ts
import 'server-only' // hard guard — build fails if imported into a client bundle
import { createClient } from '@supabase/supabase-js'

/**
 * Service-role Supabase client. Bypasses RLS. Use ONLY in server actions
 * for privileged operations (auth.admin.deleteUser()).
 *
 * Created per-call (not module-scoped) so the key is never held longer
 * than a single request. No session persistence — this client has no user.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // see Environment Availability
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  )
}
```
`[CITED: supabase.com/docs/reference/javascript/admin-api — auth.admin requires a service_role client created with createClient + the service_role key]`

> **Note on key naming:** STATE.md (Phase 39b-04 lesson) records that `.env.local` currently ships only `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and that "newer Supabase CLI uses Publishable/Secret naming, not legacy anon/service_role." The planner MUST confirm the exact env var name with the operator. The conventional name is `SUPABASE_SERVICE_ROLE_KEY`; newer Supabase projects may expose it as `SUPABASE_SECRET_KEY`. `[ASSUMED]` — `SUPABASE_SERVICE_ROLE_KEY` is the var name; verify against the live Supabase dashboard before planning is locked. This is a Wave 0 / operator-input dependency.

### Pattern 2: Storage folder purge (list-then-remove)

**What:** Supabase Storage has no native "delete folder" — you `.list()` the prefix, collect names, then `.remove()` the full paths.
**When to use:** Both Wipe and Delete must purge `wear-photos/{userId}/`.
**Example:**

```typescript
// Inside a server action — supabase = session-scoped server client (or admin client)
async function purgeWearPhotos(supabase: SupabaseClient, userId: string) {
  // List every object directly under the user's folder.
  const { data: files, error: listErr } = await supabase.storage
    .from('wear-photos')
    .list(userId, { limit: 1000 }) // see Pitfall — paginate if > 1000

  if (listErr) throw listErr
  if (!files || files.length === 0) return // nothing to purge — fine

  const paths = files.map((f) => `${userId}/${f.name}`)
  const { error: removeErr } = await supabase.storage
    .from('wear-photos')
    .remove(paths)
  if (removeErr) throw removeErr
}
```
`[VERIFIED: codebase — src/app/actions/wearEvents.ts uses storage.from('wear-photos').list(userId, {...}) and .remove([path]); path convention {userId}/{wearEventId}.jpg confirmed in src/lib/storage/wearPhotos.ts]`

> The existing `wear-photos` DELETE RLS policy (`supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql`) allows `authenticated` users to delete objects where `(storage.foldername(name))[1] = auth.uid()::text` — so the **session-scoped server client is sufficient for the Wipe purge** (caller deletes only their own folder). For Delete Account, either client works; if running the purge AFTER `auth.admin.deleteUser()` the session is gone, so **purge storage BEFORE the auth delete** (success criterion 2 mandates this anyway).

### Pattern 3: Re-auth-then-act inside the modal (D-03)

**What:** Copy the `signInWithPassword` session-refresh logic from `PasswordReauthDialog` into each modal's execute step — do NOT import the component.
**When to use:** Both modals, on the combined step-2 execute.
**Example:**

```typescript
// Inside WipeCollectionModal / DeleteAccountModal — 'use client'
async function handleExecute() {
  const supabase = createSupabaseBrowserClient()
  // Step A — re-auth (D-03 pattern, NOT the PasswordReauthDialog component)
  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email: currentEmail,
    password,
  })
  if (signInErr) {
    // surface neutral "Password incorrect." — mirror PasswordReauthDialog copy
    return
  }
  // Step B — call the server action (session is now fresh)
  const result = await wipeCollection() // or deleteAccount()
  // ... handle result per D-06 / D-07
}
```
`[VERIFIED: codebase — src/components/settings/PasswordReauthDialog.tsx lines 89-122 ship this exact signInWithPassword pattern; D-03 mandates pattern-reuse not component-reuse]`

### Pattern 4: react-email shared layout + per-template files

**What:** One layout component owns the wordmark header, 600px container, and footer; three thin template files supply body copy + CTA.
**When to use:** Track B.
**Example:**

```tsx
// emails/components/HorloEmailLayout.tsx
import { Html, Head, Body, Container, Section, Text, Hr } from '@react-email/components'

const ACCENT = '#d9a441' // hex fallback for oklch(0.76 0.12 75) — see Pitfall

export function HorloEmailLayout({ preview, children }: { preview: string; children: React.ReactNode }) {
  return (
    <Html>
      <Head />
      <Body style={{ backgroundColor: '#ffffff', margin: 0, fontFamily: 'Arial, Helvetica, sans-serif' }}>
        <Container style={{ width: '600px', maxWidth: '100%', margin: '0 auto', padding: '32px 24px' }}>
          <Section>
            {/* D-10 — text wordmark, NOT an <img> */}
            <Text style={{ fontSize: '24px', fontWeight: 700, color: ACCENT, margin: 0 }}>Horlo</Text>
          </Section>
          <Hr />
          {children}
        </Container>
      </Body>
    </Html>
  )
}
```
`[CITED: react.email/docs — @react-email/components primitives render table-based, inline-styled HTML]`

### Anti-Patterns to Avoid

- **Caching the admin client at module scope:** Create it per-call. A module-scoped service-role client risks the key surviving across requests and being harder to reason about. The cost is negligible (no network on construction).
- **Importing the admin client into a Server Component / page:** `import 'server-only'` guards against client bundles, but a Server Component that streams HTML to the browser still should not touch the service-role client. Confine it to server actions.
- **Running `auth.admin.deleteUser()` before the storage purge:** The session-scoped client loses its session the instant the auth user is gone. Success criterion 2 mandates storage purge FIRST regardless.
- **Putting `emails/` under `src/`:** D-09 explicitly says repo root, build-excluded. Under `src/` it would be type-checked and could leak into the Next.js build graph.
- **Using `oklch()` in email HTML:** Outlook MSO, older Apple Mail, and many clients do not support `oklch()` — the color silently fails. Always hex/rgb (D-11).
- **A shared parametrized danger modal:** D-01 forbids it — two separate components.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML email layout | Hand-written `<table>` email HTML with inline CSS + MSO conditionals | `react-email` + `@react-email/components` | Email HTML is a minefield (table layout, VML buttons, MSO ghost tables, inline-only CSS); react-email's `<Button>`/`<Container>` emit client-safe markup. D-09 picks react-email. |
| CSS inlining for email | Manual `style=""` on every element | `npx react-email export` (inlines automatically) | The export step inlines all styles — required because Gmail strips `<style>` blocks |
| Service-role client | Raw `fetch()` to the GoTrue admin REST endpoint | `@supabase/supabase-js` `createClient` + `auth.admin.deleteUser()` | The SDK handles the admin API surface, auth headers, and error shapes |
| Recursive folder delete | A custom recursion over Storage prefixes | `.list(prefix)` then `.remove(paths)` | `wear-photos/{userId}/` is flat (one level: `{userId}/{wearEventId}.jpg`) — a single `.list()` + `.remove()` covers it (paginate only if > 1000 files; see Pitfall) |
| FK cascade deletes | Manually deleting every child table in dependency order | Delete the `public.users` row and let Postgres `ON DELETE CASCADE` fan out | All user-scoped tables already FK to `public.users` with `ON DELETE CASCADE` — see Runtime State Inventory. One `DELETE FROM public.users WHERE id = $1` cascades to everything. |

**Key insight:** Track B is entirely a "don't hand-roll" exercise — react-email exists precisely so you never hand-write email HTML. Track A's cascade deletion is "don't hand-roll" too: the schema's existing `ON DELETE CASCADE` FKs do the fan-out; the only manual work is (a) storage purge and (b) deleting the right *root* row.

## Runtime State Inventory

> Phase 41's Delete Account is a destructive data operation — this inventory is the load-bearing analysis. **The critical finding: `public.users` has NO FK to `auth.users`.** `auth.admin.deleteUser()` alone leaves `public.users` and all its children orphaned.

### FK Cascade Map — what `DELETE FROM public.users WHERE id = $userId` cascades to

`[VERIFIED: src/db/schema.ts + drizzle/0000_flaky_lenny_balinger.sql + supabase migrations]`

| Table | FK to `public.users` | `ON DELETE` | Cascades on `public.users` delete? |
|-------|----------------------|-------------|-------------------------------------|
| `watches` | `user_id` | `cascade` | ✅ yes |
| `wear_events` | `user_id` (and `watch_id` → `watches` cascade) | `cascade` | ✅ yes |
| `user_preferences` | `user_id` | `cascade` | ✅ yes |
| `profiles` | `id` | `cascade` | ✅ yes |
| `profile_settings` | `user_id` | `cascade` | ✅ yes |
| `follows` | `follower_id` + `following_id` | `cascade` | ✅ yes (rows where the user is on either side) |
| `activities` | `user_id` | `cascade` | ✅ yes |
| `notifications` | `user_id` | `cascade` | ✅ yes (user's own inbox) |
| `notifications` | `actor_id` | `cascade` | ✅ yes — **this is the D-08 cascade. `ON DELETE CASCADE` on `actor_id` means the WHOLE notification row is removed from other users' inboxes** (not nulled). At single-user scale, no other inboxes exist — observationally inert. |

### Tables that FK to `auth.users` directly (NOT `public.users`)

| Table | FK target | `ON DELETE` | Cascades on `auth.admin.deleteUser()`? |
|-------|-----------|-------------|-----------------------------------------|
| `divestments` | `auth.users(id)` | `cascade` | ✅ yes — `divestments` auto-purge when the auth user is deleted (per `supabase/migrations/20260511010000_phase37_layer_d.sql`). Note the Drizzle schema models it as `users.id` but the live migration FKs to `auth.users` — both resolve to the same UUID. |

### Runtime State Inventory table

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data — DB rows | **Wipe scope:** `watches` + `wear_events` rows for the owner. **Delete scope:** ALL user-scoped tables above. **`public.users` is NOT FK-linked to `auth.users`** — `auth.admin.deleteUser()` does not touch it. | Delete: explicit `DELETE FROM public.users WHERE id = $userId` (cascades to all 9 child tables) **plus** `auth.admin.deleteUser()` to remove the `auth.users` row. `divestments` cascades via the `auth.users` delete. Wipe: delete `wear_events` then `watches` rows (or just `watches` — `wear_events.watch_id` cascades). |
| Live service config | Supabase Auth email templates live in the Supabase **dashboard** (Authentication → Email Templates) — NOT in the git repo. Track B's deliverable is HTML pasted there. The `emails/` source dir is the committed source-of-truth but the live template is dashboard state. | Operator manually pastes 3 exported HTML files into the dashboard. This is a `checkpoint: human-action` step — no automation. |
| OS-registered state | None. No OS-level registration involved. | None — verified (this is a web app; no Task Scheduler / launchd / pm2). |
| Secrets / env vars | `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY` under newer naming) is NEW — not in `.env.example`. `.env.local` currently ships only `NEXT_PUBLIC_SUPABASE_ANON_KEY` (STATE.md Phase 39b-04 lesson). | Add the service-role key to `.env.local` AND `.env.example` (documented, value redacted). Vercel/prod env must also carry it. Operator-input dependency — confirm exact var name. |
| Build artifacts | `emails/` exports to `emails/out/*.html` — these are generated artifacts. Decide whether `out/` is gitignored (regenerable) or committed. `react-email`/`@react-email/components` added to `devDependencies` → `package-lock.json` changes. | Add `emails/out/` to `.gitignore` (recommended — regenerable). Ensure `emails/` is excluded from `tsconfig.json` / Next build (D-09). |

### The canonical question — after the repo is updated, what runtime state still holds old data?

For Delete Account specifically: after `auth.admin.deleteUser()` runs, if the action did NOT also delete `public.users`, then `public.users` + `watches` + `wear_events` + `profiles` + `follows` + ... all remain as orphaned rows with a `user_id` that no longer resolves to any `auth.users` record. The username stays "taken" in `profiles`, the watches still count toward catalog `owners_count`, etc. **The plan MUST include the explicit `public.users` deletion.** This is the #1 correctness risk in the phase.

> **Build-excluding `emails/`:** Next.js 16 only compiles files reachable from the `src/app` route graph plus anything `tsconfig.json` `include`s. Since `emails/` is at repo root and nothing in `src/` imports it, it will not enter the Next build automatically. To be safe and explicit, add `emails` to `tsconfig.json` `exclude` (or keep `emails/` out of `include`). `[ASSUMED]` — verify Next 16 build does not pick up root-level `.tsx` files; consult `node_modules/next/dist/docs/` per AGENTS.md.

## Common Pitfalls

### Pitfall 1: `auth.admin.deleteUser()` leaves `public.users` orphaned

**What goes wrong:** Planner assumes `auth.admin.deleteUser()` is a full hard delete. It deletes only the `auth.users` row. `public.users` (and its 9 cascade children) survive as orphans.
**Why it happens:** The `public.users` table is a *shadow* table synced one-way by an AFTER-INSERT trigger; there is no FK and no AFTER-DELETE trigger from `auth.users`.
**How to avoid:** The `deleteAccount` server action must explicitly `DELETE FROM public.users WHERE id = $userId` (cascades everything) **and** call `auth.admin.deleteUser()`. Order: storage purge → `public.users` delete → `auth.admin.deleteUser()` (or auth-delete first — `divestments` cascades off `auth.users`, but the `public.users` delete is independent of order since there is no FK between them).
**Warning signs:** After a test delete, query `SELECT * FROM public.users WHERE id = '...'` and find a surviving row.

### Pitfall 2: Storage purge order — must precede the DB delete

**What goes wrong:** If the DB delete runs first and the storage purge fails, you have orphaned `wear-photos/{userId}/` objects with no DB rows referencing them — and no `wear_events` row to even discover the paths from.
**Why it happens:** Natural coding order is "delete rows, then files."
**How to avoid:** Success criterion 2 mandates storage-first. Purge `wear-photos/{userId}/` via `.list()` + `.remove()` BEFORE any DB delete. The folder path is `{userId}/` — derivable from the user ID alone, no DB lookup needed.
**Warning signs:** Objects visible in the Supabase Storage dashboard under a userId folder after a delete.

### Pitfall 3: Supabase Storage `.list()` caps at 1000 by default

**What goes wrong:** A user with > 1000 wear photos gets a partial purge — only the first 1000 objects deleted.
**Why it happens:** `.list()` default `limit` is 100 (max 1000); it does not auto-paginate.
**How to avoid:** Set `{ limit: 1000 }`. At Horlo's scale (<500 watches, one photo per wear event) 1000 is plausibly enough, but the FK-safe approach is a paginate loop: `.list(userId, { limit: 1000, offset: n })` until a page returns fewer than 1000. Recommend the loop for correctness.
**Warning signs:** Heavy-user test leaves storage objects behind.
`[CITED: supabase.com/docs/reference/javascript/storage-from-list — default limit 100, max 1000]`

### Pitfall 4: `oklch()` in email HTML silently fails

**What goes wrong:** The accent color `oklch(0.76 0.12 75)` renders as a default/black in Outlook MSO and older clients — no error, just wrong color.
**Why it happens:** Email clients (especially Outlook's Word rendering engine) support a narrow CSS subset; `oklch()` is not in it.
**How to avoid:** Convert the accent to hex once and use the hex literal everywhere in the email. `oklch(0.76 0.12 75)` ≈ a warm amber/gold — approximately `#d9a441` / `#cf9f3e`. **The planner/executor MUST compute the exact hex** (the CONTEXT only gives the oklch; do the conversion deterministically, e.g. via a color tool, and verify the swatch against the app's rendered accent). `[ASSUMED]` — `#d9a441` is an approximate conversion of `oklch(0.76 0.12 75)`; compute and verify the exact value during planning/execution.
**Warning signs:** Email CTA button is black in Outlook preview.

### Pitfall 5: Apple Mail iOS dark mode color inversion

**What goes wrong:** Apple Mail on iOS auto-inverts colors in dark mode; a white-background email with dark text can become unreadable or the wordmark color shifts.
**Why it happens:** iOS Mail applies its own dark-mode color transform unless the email opts into explicit dark-mode handling.
**How to avoid:** Use a `<meta name="color-scheme" content="light dark">` and `<meta name="supported-color-schemes" content="light dark">` in `<Head>`, keep contrast high, and test the exported HTML in Apple Mail iOS dark mode (success criterion 4 mandates this verification). react-email's `<Head>` accepts children for the meta tags.
**Warning signs:** Wordmark or CTA invisible against the inverted background on iPhone.

### Pitfall 6: Gmail strips `<style>` blocks → all CSS must be inline

**What goes wrong:** A `<style>` block in `<Head>` is stripped by Gmail web; any non-inline styling is lost.
**Why it happens:** Gmail's well-known HTML sanitization.
**How to avoid:** `npx react-email export` inlines styles automatically. Use the `style={{}}` prop on react-email components (not `className`/`<style>`). The export step handles it.
**Warning signs:** Email looks unstyled in Gmail web but correct in the preview server.

### Pitfall 7: Supabase template variables are Go templates — not substituted by react-email

**What goes wrong:** Putting `{{ .ConfirmationURL }}` literally in a react-email component, then react-email/JSX choking on the braces, or the variable not surviving export.
**Why it happens:** `{{ .ConfirmationURL }}` is a Go-template token interpreted by Supabase's GoTrue server at send time — react-email knows nothing about it.
**How to avoid:** In JSX, the literal string must be emitted verbatim into the HTML. Use a string expression: `href={'{{ .ConfirmationURL }}'}` or put the token in a `{' '}`-safe string. After `npx react-email export`, grep the output HTML to confirm `{{ .ConfirmationURL }}` appears literally. Supabase then substitutes it.
**Warning signs:** Exported HTML shows `&#123;&#123;` (HTML-escaped braces) or the link is broken in a real email.

### Pitfall 8: `signInWithPassword` rotates the session (D-03 carries a known wrinkle)

**What goes wrong:** Re-auth via `signInWithPassword` issues a fresh session. For Wipe this is fine. For Delete Account, the immediate next step is the server action that ends with `auth.admin.deleteUser()` then a client `signOut()` — make sure the modal does not try to use a stale session reference after re-auth.
**Why it happens:** `signInWithPassword` returns a new session; the browser client updates cookies via the proxy.
**How to avoid:** Re-auth, then immediately call the server action, then `signOut()` + redirect. Don't cache session objects across these steps. Mirror the `PasswordReauthDialog` flow which already handles this correctly.
**Warning signs:** Server action sees an unauthenticated request right after a successful re-auth.

## Code Examples

### Supabase Auth template variables (per template)

`[CITED: supabase.com/docs/guides/auth/auth-email-templates]`

| Template | Primary variable | Other available |
|----------|------------------|-----------------|
| **Confirm signup** | `{{ .ConfirmationURL }}` | `{{ .Token }}` (6-digit OTP), `{{ .TokenHash }}`, `{{ .SiteURL }}`, `{{ .Email }}`, `{{ .RedirectTo }}` |
| **Reset Password** | `{{ .ConfirmationURL }}` | `{{ .Token }}`, `{{ .TokenHash }}`, `{{ .SiteURL }}`, `{{ .Email }}`, `{{ .RedirectTo }}` |
| **Change Email Address** | `{{ .ConfirmationURL }}` | `{{ .Token }}`, `{{ .TokenHash }}`, `{{ .Email }}` (old), `{{ .NewEmail }}`, `{{ .SiteURL }}` |

The single-CTA button in each template links to `{{ .ConfirmationURL }}`. The Change Email template can personalize body copy with `{{ .Email }}` (old address) and `{{ .NewEmail }}`.

### react-email template skeleton (Confirm signup)

```tsx
// emails/confirm-signup.tsx
import { Section, Text, Button, Heading } from '@react-email/components'
import { HorloEmailLayout } from './components/HorloEmailLayout'

const ACCENT = '#d9a441' // verify exact hex for oklch(0.76 0.12 75)

export default function ConfirmSignup() {
  return (
    <HorloEmailLayout preview="Confirm your Horlo email address">
      <Section>
        <Heading style={{ fontSize: '20px', color: '#111111' }}>Confirm your email</Heading>
        <Text style={{ fontSize: '15px', color: '#444444' }}>
          Welcome to Horlo. Confirm your email address to start building your collection.
        </Text>
        <Button
          href="{{ .ConfirmationURL }}"
          style={{
            backgroundColor: ACCENT,
            color: '#ffffff',
            padding: '12px 24px',
            borderRadius: '6px',
            fontSize: '15px',
            textDecoration: 'none',
            display: 'inline-block',
          }}
        >
          Confirm your email
        </Button>
      </Section>
    </HorloEmailLayout>
  )
}
```
> The `href="{{ .ConfirmationURL }}"` literal survives export — react-email passes the string through. Confirm in `emails/out/confirm-signup.html` after `npx react-email export`.

### react-email CLI commands

```bash
# Preview server during authoring (run from emails/ or with --dir)
npx react-email dev --dir emails

# Export all templates to static inlined HTML
npx react-email export --dir emails --outDir emails/out
```
`[CITED: react.email/docs/cli — `dev` runs the preview server, `export` renders templates to static HTML]`

### Wipe Collection server action shape

```typescript
// src/app/actions/account.ts
'use server'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { db } from '@/db'
import { watches, wearEvents } from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { ActionResult } from '@/lib/actionTypes'

export async function wipeCollection(): Promise<ActionResult<void>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }

  const supabase = await createSupabaseServerClient()
  // 1 — storage purge FIRST (success criterion 2)
  // ...paginate .list(user.id) + .remove() ...
  // 2 — DB rows. wear_events.watch_id cascades from watches, but delete
  //     wear_events explicitly too (covers any future direct-user rows).
  await db.delete(wearEvents).where(eq(wearEvents.userId, user.id))
  await db.delete(watches).where(eq(watches.userId, user.id))
  return { success: true, data: undefined }
}
```
> `revalidatePath`/`updateTag` for collection/profile surfaces should follow the project's established invalidation pattern (see STATE.md Phase 39c-05 cache-tag work — `removeWatch` already tags `profile:${username}`).

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-email` v5.x | `react-email` 6.x (6.0 release) | 2025 | 6.x is the current major; SET-14's "6.1.1" is a 6.x pin. 6.1.4 is npm latest. |
| Supabase legacy `anon`/`service_role` JWT key names | Newer projects: Publishable / Secret key naming | 2025 (Supabase API key revamp) | The service-role equivalent may be exposed as a "secret key" in newer dashboards — confirm the env var name (see Runtime State Inventory) |
| Hand-written HTML email | react-email component authoring + CLI export | — | D-09 picks the current approach |

**Deprecated/outdated:**
- Nothing in the project is deprecated for this phase. `@supabase/supabase-js` `^2.103.0` and `@supabase/ssr` `^0.10.2` are current.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The service-role env var is named `SUPABASE_SERVICE_ROLE_KEY` | Standard Stack / Runtime State Inventory | Server action throws on a missing env var; Delete Account fails. **Operator must confirm the exact name against the live Supabase dashboard.** Mitigation: make this a Wave 0 / human-input dependency. |
| A2 | SET-14's "react-email 6.1.1" refers to the `react-email` CLI package version (not `@react-email/components`) | Standard Stack | Low — patch drift within 6.x is safe; planner picks the exact pin |
| A3 | Next.js 16 will not auto-include root-level `emails/*.tsx` in the build | Architecture / Runtime State Inventory | If wrong, react-email components leak into the Next build and could break it. Mitigation: explicitly `exclude` `emails` in `tsconfig.json`; consult `node_modules/next/dist/docs/` per AGENTS.md |
| A4 | `oklch(0.76 0.12 75)` ≈ hex `#d9a441` | Common Pitfalls / Code Examples | Wrong brand color in emails. Mitigation: compute the exact hex deterministically during execution and verify the swatch against the app accent |
| A5 | `divestments` FK to `auth.users` means divestments auto-purge on `auth.admin.deleteUser()` | Runtime State Inventory | Verified from the migration SQL — but the Drizzle schema models it as `users.id`. Both resolve to the same UUID; the live DB FK (auth.users) governs cascade. Low risk — confirm with a test delete. |

## Open Questions

1. **Exact service-role env var name**
   - What we know: The conventional name is `SUPABASE_SERVICE_ROLE_KEY`; STATE.md notes newer Supabase CLI uses Publishable/Secret naming.
   - What's unclear: Whether this project's Supabase dashboard exposes it as `service_role` or `secret`.
   - Recommendation: Operator confirms the name and adds the key to `.env.local`, `.env.example`, and Vercel env before the Delete Account plan is executed. Treat as a Wave 0 human-action dependency.

2. **Is `emails/out/` committed or gitignored?**
   - What we know: It is regenerable via `npx react-email export`.
   - What's unclear: Project preference.
   - Recommendation: Gitignore `emails/out/`; the `.tsx` sources are the committed source of truth (D-09). The final HTML lives in the Supabase dashboard anyway.

3. **Wipe Collection cache invalidation scope**
   - What we know: STATE.md Phase 39c-05 wired `profile:${username}` tags on `removeWatch`; the 39c UAT flagged that `removeWatch` invalidation does not reach the explore/discovery rail.
   - What's unclear: Whether Wipe should fan out broader cache invalidation than a single `removeWatch`.
   - Recommendation: Planner mirrors the `removeWatch` invalidation set (it deletes the same kind of rows en masse) and accepts the known explore-rail staleness as a pre-existing tracked issue, not a Phase 41 regression.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@supabase/supabase-js` | Service-role admin client | ✓ | `^2.103.0` | — |
| `SUPABASE_SERVICE_ROLE_KEY` env var | `auth.admin.deleteUser()` | ✗ | — | **No fallback — blocking for Delete Account.** Operator must add it. |
| `react-email` CLI | Track B authoring/export | ✗ (not installed) | install `6.1.x` | — install as devDependency |
| `@react-email/components` | Track B templates | ✗ (not installed) | install `^1.0.12` | — install as devDependency |
| `sonner` | Wipe success toast | ✓ | `^2.0.7` | — |
| Supabase Auth dashboard access | Pasting exported email HTML | ✓ (operator has it) | — | — |

**Missing dependencies with no fallback:**
- `SUPABASE_SERVICE_ROLE_KEY` (or its newer-naming equivalent) — Delete Account cannot work without it. This is a human/operator-input Wave 0 dependency.

**Missing dependencies with fallback:**
- `react-email` + `@react-email/components` — not installed, but a one-command `npm install --save-dev` resolves it. No blocker.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest `^2.1.9` + `@testing-library/react` `^16.3.2` + jsdom `^25.0.1` |
| Config file | `vitest.config.ts` (does NOT auto-load `.env.local` — STATE.md Phase 36-04 lesson) |
| Quick run command | `npx vitest run <file>` |
| Full suite command | `npm test` (`vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SET-13 | `wipeCollection` deletes `watches` + `wear_events`, preserves account/profile/follows | integration (DB) | `npx vitest run tests/integration/account-wipe.test.ts` | ❌ Wave 0 |
| SET-13 | `deleteAccount` purges storage, deletes `public.users` (cascade), calls `auth.admin.deleteUser()` | integration (DB + storage) | `npx vitest run tests/integration/account-delete.test.ts` | ❌ Wave 0 |
| SET-13 | Storage purge runs BEFORE DB delete (ordering) | integration | covered in `account-delete.test.ts` (assert call order) | ❌ Wave 0 |
| SET-13 | `WipeCollectionModal` — execute button disabled until typed text === `WIPE` | component | `npx vitest run tests/components/WipeCollectionModal.test.tsx` | ❌ Wave 0 |
| SET-13 | `DeleteAccountModal` — execute button disabled until typed text === `DELETE` | component | `npx vitest run tests/components/DeleteAccountModal.test.tsx` | ❌ Wave 0 |
| SET-13 | Modal step flow: warn → confirm-step → execute | component | covered in the two modal test files | ❌ Wave 0 |
| SET-14 | Exported HTML contains literal `{{ .ConfirmationURL }}` | static | `npx vitest run tests/static/email-templates.test.ts` (grep exported HTML) | ❌ Wave 0 |
| SET-14 | Exported HTML uses hex accent (no `oklch(`), 600px container, single `<a>` CTA | static | covered in `email-templates.test.ts` | ❌ Wave 0 |
| SET-14 | Cross-client rendering (Apple Mail iOS dark, Outlook MSO, Gmail web) | manual-only | manual — no automated email-client renderer in-project | N/A (manual UAT — success criterion 4) |

> **Manual-only justification:** Cross-client email rendering (success criterion 4) cannot be automated without a paid email-testing service (Litmus/Email on Acid). This is a human UAT item. The *static* properties of the exported HTML (token presence, hex color, 600px width, single CTA) ARE automatable via a grep-style test over `emails/out/*.html`.

### Sampling Rate

- **Per task commit:** `npx vitest run <touched-test-file>`
- **Per wave merge:** `npm test` (full suite)
- **Phase gate:** Full suite green + `npm run build` exit 0 before `/gsd-verify-work`. Note the project baseline is ~48-51 pre-existing failing tests (STATE.md) and ~27-28 tsc errors — measure regression delta, not absolute zero.

### Wave 0 Gaps

- [ ] `tests/integration/account-wipe.test.ts` — covers SET-13 Wipe scope (gated on DB env per Phase 36-04 `set -a; source .env.local` pattern)
- [ ] `tests/integration/account-delete.test.ts` — covers SET-13 Delete scope + storage-before-DB ordering + `public.users` cascade
- [ ] `tests/components/WipeCollectionModal.test.tsx` — covers type-to-confirm gate + step flow
- [ ] `tests/components/DeleteAccountModal.test.tsx` — covers type-to-confirm gate + step flow
- [ ] `tests/static/email-templates.test.ts` — covers exported HTML static properties (SET-14)
- [ ] Framework install: `npm install --save-dev react-email @react-email/components` (Track B)

## Project Constraints (from CLAUDE.md / AGENTS.md)

- **Next.js 16.2.3 App Router only** — no `pages/` dir. AGENTS.md: "This is NOT the Next.js you know" — consult `node_modules/next/dist/docs/` before writing App Router code. `await cookies()` is required (see `src/lib/supabase/server.ts`).
- **GSD workflow enforcement** — all edits must go through a GSD command.
- **Naming conventions:** PascalCase components/files (`WipeCollectionModal.tsx`), camelCase non-component files (`account.ts`, `admin.ts`), `use<Name>Store` for stores. Absolute imports via `@/*`. `import type` for type-only imports. No barrel files.
- **React patterns:** `'use client'` only where client state is needed (the modals); Server Components by default (`AccountSection.tsx` stays a Server Component — the modals are client islands mounted within it). `export default function` for pages, named exports for shared components.
- **Styling:** Tailwind 4 utility classes inline; `cn()` helper for conditional classes; shadcn primitives in `src/components/ui/`.
- **Server actions:** live in `src/app/actions/`; validate input with early returns + `ActionResult` shape; try/catch with `console.error` for unexpected failures.
- **Don't break existing types:** `Watch` / `UserPreferences` types are established — extend, don't break.
- **`emails/` is NOT app code** — `react-email`/`@react-email/components` go in `devDependencies`; the directory is build-excluded. This is the one place CLAUDE.md conventions (which govern `src/`) do not apply — `emails/` follows react-email conventions.

## Sources

### Primary (HIGH confidence)
- Codebase — `src/db/schema.ts`, `drizzle/0000_flaky_lenny_balinger.sql` — FK cascade map, `public.users` has no FK to `auth.users`
- Codebase — `supabase/migrations/20260413000000_sync_auth_users.sql` — `on_auth_user_created` AFTER-INSERT trigger; one-way sync, no AFTER-DELETE
- Codebase — `supabase/migrations/20260423000004_phase11_storage_bucket_rls.sql` — `wear-photos` bucket + DELETE RLS policy (`(storage.foldername(name))[1] = auth.uid()::text`)
- Codebase — `supabase/migrations/20260511010000_phase37_layer_d.sql` — `divestments` FKs `auth.users(id) ON DELETE CASCADE`
- Codebase — `src/app/actions/wearEvents.ts`, `src/lib/storage/wearPhotos.ts` — `wear-photos` `.list()`/`.remove()` patterns, `{userId}/{wearEventId}.jpg` path convention
- Codebase — `src/components/settings/PasswordReauthDialog.tsx` — `signInWithPassword` re-auth pattern (D-03 source)
- Codebase — `src/lib/supabase/server.ts`, `client.ts` — existing client patterns
- npm registry (`npm view`) — `react-email` 6.1.4 latest, `@react-email/components` 1.0.12, `@react-email/render` 2.0.8
- supabase.com/docs/guides/auth/auth-email-templates — Auth email template variables

### Secondary (MEDIUM confidence)
- react.email/docs/cli — `dev` and `export` CLI commands
- supabase.com/docs/reference/javascript/admin-api — `auth.admin` requires a `service_role` client
- supabase.com/docs/reference/javascript/storage-from-list — `.list()` default limit 100, max 1000

### Tertiary (LOW confidence)
- `oklch(0.76 0.12 75)` ≈ `#d9a441` — approximate color conversion; verify exact hex during execution

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against npm registry; `@supabase/supabase-js` already installed
- Architecture (FK cascade map): HIGH — read directly from schema + migration SQL; the `public.users`/`auth.users` decoupling is the key finding and is unambiguous
- Pitfalls: MEDIUM-HIGH — storage/cascade pitfalls verified from codebase; email-client pitfalls (oklch, dark mode, Gmail) are well-established industry knowledge cross-checked with docs
- Email template variables: HIGH — Supabase official docs
- Service-role env var name: LOW — must be confirmed by operator

**Research date:** 2026-05-15
**Valid until:** 2026-06-14 (30 days — stable domain; re-verify react-email version if a major releases)

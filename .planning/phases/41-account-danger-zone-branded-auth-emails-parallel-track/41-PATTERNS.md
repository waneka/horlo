# Phase 41: Account Danger Zone + Branded Auth Emails - Pattern Map

**Mapped:** 2026-05-15
**Files analyzed:** 11 (5 new app files, 1 modified, 1 modified config, 4 new email files)
**Analogs found:** 7 / 7 app files (Track B email files are greenfield — no analog)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/lib/supabase/admin.ts` (NEW) | config / client factory | request-response | `src/lib/supabase/server.ts` | role-match (no service-role analog) |
| `src/app/actions/account.ts` (NEW) | server action | CRUD + file-I/O (storage purge) | `src/app/actions/wearEvents.ts`, `removeWatch` in `watches.ts` | exact |
| `src/components/settings/DangerZoneSection.tsx` (NEW) | component (client island) | event-driven (modal triggers) | `src/components/settings/AccountSection.tsx` + `SettingsSection.tsx` | role-match |
| `src/components/settings/WipeCollectionModal.tsx` (NEW) | component (dialog) | request-response (re-auth + action) | `src/components/settings/PasswordReauthDialog.tsx` | exact |
| `src/components/settings/DeleteAccountModal.tsx` (NEW) | component (dialog) | request-response (re-auth + action + signout) | `src/components/settings/PasswordReauthDialog.tsx` | exact |
| `src/components/settings/AccountSection.tsx` (MODIFIED) | component (Server Component) | composition | itself (append a 3rd child) | exact |
| `tsconfig.json` (MODIFIED) | config | build config | itself | exact |
| `emails/components/HorloEmailLayout.tsx` (NEW) | component (react-email) | static HTML | none — greenfield | no analog |
| `emails/confirm-signup.tsx` (NEW) | component (react-email) | static HTML | none — greenfield | no analog |
| `emails/reset-password.tsx` (NEW) | component (react-email) | static HTML | none — greenfield | no analog |
| `emails/change-email.tsx` (NEW) | component (react-email) | static HTML | none — greenfield | no analog |

## Pattern Assignments

### `src/lib/supabase/admin.ts` (config / client factory, request-response)

**Analog:** `src/lib/supabase/server.ts` — closest existing Supabase client factory. Note: `server.ts` is a *cookie-bound, RLS-scoped* client built with `@supabase/ssr` `createServerClient`. The admin client is a **different security posture** (service-role, RLS-bypassing) and uses the base SDK `createClient` instead. Copy the `import 'server-only'` guard and the `process.env.X!` env-access style; do NOT copy the cookie wiring.

**Patterns to copy from `server.ts` (lines 1-3):**
```typescript
import 'server-only'           // hard guard — keep this; build fails if imported into a client bundle
// (server.ts uses @supabase/ssr — admin.ts uses the base SDK instead, see below)
```

**Env-access style to mirror (server.ts lines 8-9):**
```typescript
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,   // admin.ts uses SUPABASE_SERVICE_ROLE_KEY here instead
```

**New construction (no analog — from RESEARCH §Pattern 1):** base-SDK `createClient` with `auth: { autoRefreshToken: false, persistSession: false }`, created **per-call inside an exported factory function** (`createSupabaseAdminClient()`) — never module-scoped (RESEARCH Anti-Pattern: "Caching the admin client at module scope"). Service-role env var name is an **operator-input dependency** — `SUPABASE_SERVICE_ROLE_KEY` vs `SUPABASE_SECRET_KEY` must be confirmed (RESEARCH Open Question 1 / A1).

---

### `src/app/actions/account.ts` (server action, CRUD + file-I/O)

**Analog:** `src/app/actions/wearEvents.ts` (storage `.list()`/`.remove()` + `'use server'` + `ActionResult` + auth-first ordering) and `removeWatch` in `src/app/actions/watches.ts` (DB delete + revalidation).

**File header / `'use server'` + imports pattern** (`wearEvents.ts` lines 1-13):
```typescript
'use server'

import { revalidatePath, revalidateTag } from 'next/cache'
import { getCurrentUser } from '@/lib/auth'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { ActionResult } from '@/lib/actionTypes'
```

**Auth-first guard pattern — copy verbatim** (`removeWatch`, `watches.ts` lines 467-469; identical in every action):
```typescript
export async function wipeCollection(): Promise<ActionResult<void>> {
  let user
  try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }
  // ...
}
```
`getCurrentUser()` (`src/lib/auth.ts` lines 12-20) returns `{ id, email }` and throws `UnauthorizedError` — the try/catch above is the project-wide convention.

**Storage purge pattern — list-then-remove** (`wearEvents.ts` lines 153-165 shows `.list()`; lines 188-200 show `.remove()`):
```typescript
const supabase = await createSupabaseServerClient()   // session-scoped — sufficient for Wipe (RLS allows owner to delete own folder)
const { data: listed, error: listErr } = await supabase.storage
  .from('wear-photos')
  .list(user.id, { limit: 1000 })          // RESEARCH Pitfall 3 — paginate if > 1000
// then:
await supabase.storage.from('wear-photos').remove(paths)   // paths = listed.map(f => `${user.id}/${f.name}`)
```
Path convention `{userId}/{wearEventId}.jpg` is fixed (`src/lib/storage/wearPhotos.ts` lines 28-39). **Storage purge runs BEFORE any DB delete** (RESEARCH Pitfall 2 / success criterion 2).

**DB delete delegation — DAL pattern** (`watches.ts` `removeWatch` line 472 → `src/data/watches.ts` `deleteWatch` lines 282-290):
```typescript
// DAL layer (src/data/watches.ts) — owner-scoped delete:
await db.delete(watches).where(and(eq(watches.userId, userId), eq(watches.id, watchId))).returning()
```
For Wipe: `db.delete(wearEvents).where(eq(wearEvents.userId, user.id))` then `db.delete(watches).where(eq(watches.userId, user.id))` (RESEARCH §Code Examples "Wipe Collection server action shape"). For Delete Account: `DELETE FROM public.users WHERE id = userId` cascades all 9 child tables (RESEARCH §FK Cascade Map) — then `createSupabaseAdminClient().auth.admin.deleteUser(user.id)` removes the `auth.users` row. **Critical:** `auth.admin.deleteUser()` alone does NOT cascade to `public.users` (RESEARCH Pitfall 1).

**Error handling pattern** (`removeWatch`, `watches.ts` lines 491-497):
```typescript
} catch (err) {
  console.error('[removeWatch] unexpected error:', err)
  return { success: false, error: 'Failed to delete watch' }
}
```
Use `console.error('[wipeCollection] ...', err)` / `[deleteAccount]` prefix convention.

**Revalidation pattern** (`removeWatch`, `watches.ts` lines 473-488):
```typescript
revalidatePath('/')
const ownerProfile = await getProfileById(user.id)
if (ownerProfile?.username) {
  revalidateTag(`profile:${ownerProfile.username}`, 'max')
}
revalidateTag('explore', 'max')
```
Wipe should mirror `removeWatch`'s invalidation set (RESEARCH Open Question 3 — accept known explore-rail staleness as pre-existing). Delete Account ends with a client-side `signOut()` + redirect, so server-side revalidation is less load-bearing there.

---

### `src/components/settings/WipeCollectionModal.tsx` (component, request-response)

**Analog:** `src/components/settings/PasswordReauthDialog.tsx` — exact match for Dialog + `useFormFeedback({ dialogMode: true })` + `signInWithPassword` re-auth. **Copy the *pattern*, NOT the component** (D-03 — `PasswordReauthDialog` is coupled to `pendingNewPassword`).

**`'use client'` + imports pattern** (`PasswordReauthDialog.tsx` lines 1-16):
```typescript
'use client'
import { useState } from 'react'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useFormFeedback } from '@/lib/hooks/useFormFeedback'
```

**Feedback hook + open-change reset pattern** (`PasswordReauthDialog.tsx` lines 73-87):
```typescript
const { pending, message, run, reset: resetFeedback } = useFormFeedback({ dialogMode: true })

function handleOpenChange(next: boolean) {
  if (!next) {
    resetField()        // for Phase 41: reset to step 1, clear typed-keyword + password fields
    resetFeedback()
  }
  onOpenChange(next)
}
```
For the 2-step modal, `resetField()` also resets `step` state back to 1 (UI-SPEC "Dismiss/reset" contract).

**Re-auth-then-act pattern — copy this logic** (`PasswordReauthDialog.tsx` lines 89-122; D-03 mandates pattern-reuse):
```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault()
  run(async () => {
    const supabase = createSupabaseBrowserClient()
    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: currentEmail,
      password,
    })
    if (signInErr) {
      return { success: false as const, error: 'Password incorrect.' }   // neutral copy — UI-SPEC locked
    }
    // Phase 41 swap: instead of updateUser(), call the server action:
    const result = await wipeCollection()        // or deleteAccount()
    if (!result.success) {
      return { success: false as const, error: 'Could not wipe your collection. Try again.' }
    }
    resetField()
    onOpenChange(false)
    return { success: true as const, data: undefined }
  }, { successMessage: 'Collection wiped' })       // D-06 Sonner toast — hook fires toast.success
}
```
The `useFormFeedback` hook fires `toast.success` when `successMessage` is passed (`useFormFeedback.ts` lines 164-189) — this satisfies D-06.

**Disabled-button gate pattern** (`PasswordReauthDialog.tsx` line 163 — `disabled={pending || !password}`):
```typescript
// Phase 41 D-05 — extend the gate with the type-to-confirm keyword match:
<Button type="submit" variant="destructive" disabled={pending || typed !== 'WIPE' || !password}>
  {pending ? 'Wiping…' : 'Wipe Collection'}
</Button>
```

**Inline error surface pattern** (`PasswordReauthDialog.tsx` lines 150-152) — errors are inline, NOT toasts:
```typescript
{message && !pending && (
  <p className="text-sm text-destructive">{message}</p>
)}
```

**Form field pattern** (`PasswordReauthDialog.tsx` lines 134-145):
```typescript
<form onSubmit={handleSubmit} className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="reauth-password">Current password</Label>
    <Input id="reauth-password" type="password" required autoComplete="current-password"
           value={password} onChange={(e) => setPassword(e.target.value)} />
  </div>
```
Phase 41 step 2 adds a second field above this: the type-to-confirm `Input` (label `Confirm`, placeholder = keyword).

**Footer pattern** (`PasswordReauthDialog.tsx` lines 154-166): `DialogFooter` with a `variant="outline"` Cancel/Back button + the execute button. For step 1 the footer is Cancel (`outline`) + Continue (`destructive`).

---

### `src/components/settings/DeleteAccountModal.tsx` (component, request-response)

**Analog:** identical to `WipeCollectionModal` above — same `PasswordReauthDialog.tsx` pattern. D-01 forbids a shared parametrized component; this is a separate file.

**Divergences from WipeCollectionModal:**
- Keyword is `DELETE` (D-04): `disabled={pending || typed !== 'DELETE' || !password}`.
- Calls `deleteAccount()` server action instead of `wipeCollection()`.
- **No success toast** (UI-SPEC line 195) — post-success path signs the user out and redirects. Pass NO `successMessage` to `run()` — the hook suppresses the toast when neither `successMessage` nor `successAction` is provided (`useFormFeedback.ts` lines 165-177).
- Post-success: after `deleteAccount()` resolves, call `await supabase.auth.signOut()` then redirect to `/` (D-07). Sign-out pattern reference: `src/app/actions/auth.ts` lines 5-9 uses `supabase.auth.signOut()` then `redirect()` server-side — but Phase 41 D-07 runs the sign-out on the **browser client** then a client-side `router.push('/')` (the auth user is already deleted server-side; the browser just needs to clear its session). RESEARCH Pitfall 8 — do not cache session objects across re-auth → action → signOut.

---

### `src/components/settings/DangerZoneSection.tsx` (component, event-driven)

**Analog:** `src/components/settings/AccountSection.tsx` (composition shape) + `src/components/settings/SettingsSection.tsx` (card-wrapper shape). No exact analog — this is a new client island composing the two modals + trigger buttons.

**Composition / file shape** (`AccountSection.tsx` lines 1-32) — named export, props interface, JSDoc citing the phase:
```typescript
import { EmailChangeForm } from './EmailChangeForm'
// ...
export function AccountSection({ ... }: AccountSectionProps) {
  return (
    <div className="space-y-8">
      <EmailChangeForm ... />
      <PasswordChangeForm ... />
    </div>
  )
}
```

**Card-wrapper styling** — UI-SPEC mandates `border border-destructive/30 rounded-lg p-6` on a `--card` surface (this DIVERGES from `SettingsSection.tsx`'s neutral `rounded-xl border bg-card p-4` — the Danger Zone uses a red-tinted border and `p-6` per UI-SPEC Spacing token `lg`). Section title: `text-destructive font-semibold text-lg`. `DangerZoneSection` is `'use client'` because it owns the modal `open` state and trigger buttons.

**Button variant** — trigger buttons use shadcn `variant="destructive"` (soft-tint: `bg-destructive/10 text-destructive hover:bg-destructive/20` per UI-SPEC) + leading lucide icon (`Trash2` for Wipe, `UserX`/`OctagonAlert` for Delete). lucide-react is already a dependency.

---

### `src/components/settings/AccountSection.tsx` (MODIFIED — Server Component)

**Analog:** itself. Append `<DangerZoneSection />` as the 3rd child of the existing `space-y-8` container (`AccountSection.tsx` lines 20-31), after `<PasswordChangeForm />`. `AccountSection` stays a Server Component — `DangerZoneSection` is a client island mounted within it (RESEARCH §Architecture; CLAUDE.md React patterns). Add one import line and one JSX line. The component takes `currentEmail` — pass it down to the modals for the `signInWithPassword` re-auth.

---

### `tsconfig.json` (MODIFIED — config)

**Critical finding (not in RESEARCH/UI-SPEC):** `tsconfig.json` `include` (lines 27-34) uses **global globs** `"**/*.ts"` and `"**/*.tsx"`. A repo-root `emails/` directory **WILL be type-checked** unless explicitly excluded. RESEARCH A3 assumed Next 16 won't pick up root `.tsx` files into the *build* — that is about the Next.js route graph, but `tsc` (`npm run build` runs `next build` which type-checks) uses this `include`. The `exclude` array (line 35) currently holds only `["node_modules"]`.

**Required modification:** add `"emails"` to the `exclude` array so the build-excluded react-email directory (D-09) does not enter type-checking:
```json
"exclude": ["node_modules", "emails"]
```
This is load-bearing for D-09 ("`emails/` is build-excluded, NOT under `src/`"). Also confirms RESEARCH A3 — verify against `node_modules/next/dist/docs/` per AGENTS.md.

---

### `emails/components/HorloEmailLayout.tsx` + `emails/{confirm-signup,reset-password,change-email}.tsx` (NEW — react-email, no analog)

**No codebase analog — greenfield.** The repo has zero email templates and no react-email usage. These files do NOT follow CLAUDE.md `src/` conventions (RESEARCH §Project Constraints — "`emails/` follows react-email conventions"). Planner uses RESEARCH §Pattern 4 + §Code Examples and UI-SPEC §Email Template Contract directly:

- Shared `HorloEmailLayout` owns: 600px `<Container>`, `Horlo` text wordmark header (D-10 — no `<img>`), `<Hr>`, footer. RESEARCH §Pattern 4 gives the skeleton.
- Three thin templates supply heading + lead + single `<Button href="{{ .ConfirmationURL }}">`. RESEARCH §Code Examples gives the `confirm-signup.tsx` skeleton.
- Primitives: `@react-email/components` (`<Html>`, `<Head>`, `<Body>`, `<Container>`, `<Section>`, `<Text>`, `<Heading>`, `<Button>`, `<Hr>`).
- Colors are hex literals only — see Shared Patterns below. `oklch()` is FORBIDDEN (RESEARCH Pitfall 4).
- `<Head>` must include `<meta name="color-scheme">` + `<meta name="supported-color-schemes">` (RESEARCH Pitfall 5).
- Go-template token `{{ .ConfirmationURL }}` must survive `npx react-email export` literally (RESEARCH Pitfall 7).

## Shared Patterns

### Server-Action Result Contract
**Source:** `src/lib/actionTypes.ts` lines 5-7
**Apply to:** `src/app/actions/account.ts` (`wipeCollection`, `deleteAccount`)
```typescript
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string }
```
Every action returns `Promise<ActionResult<void>>` — never throws across the boundary.

### Auth Guard (server-side)
**Source:** `src/lib/auth.ts` lines 12-20 (`getCurrentUser`) + the try/catch wrapper used in every action (e.g. `watches.ts` line 469)
**Apply to:** both server actions in `account.ts`
```typescript
let user
try { user = await getCurrentUser() } catch { return { success: false, error: 'Not authenticated' } }
```

### Re-auth Guard (client-side, in-modal)
**Source:** `src/components/settings/PasswordReauthDialog.tsx` lines 92-103 (D-03 — pattern, not component)
**Apply to:** `WipeCollectionModal`, `DeleteAccountModal`
```typescript
const supabase = createSupabaseBrowserClient()
const { error: signInErr } = await supabase.auth.signInWithPassword({ email: currentEmail, password })
if (signInErr) return { success: false as const, error: 'Password incorrect.' }
```

### Feedback / Toast Pattern
**Source:** `src/lib/hooks/useFormFeedback.ts` (used by `PasswordReauthDialog.tsx` line 73)
**Apply to:** both danger modals
- `useFormFeedback({ dialogMode: true })` — dialog mode suppresses the inline banner.
- Pass `successMessage` to `run()` → fires `toast.success` (Wipe — D-06).
- Pass NO `successMessage`/`successAction` → toast suppressed (Delete Account — UI-SPEC line 195).
- Errors surface inline via `{message && !pending && <p className="text-sm text-destructive">{message}</p>}`.

### `server-only` Import Guard
**Source:** `src/lib/supabase/server.ts` line 1, `src/lib/auth.ts` line 1
**Apply to:** `src/lib/supabase/admin.ts`
```typescript
import 'server-only'
```
Note `tsconfig.json` line 24 maps `server-only` to a test shim — the import works in both build and Vitest.

### Storage Folder Purge (list-then-remove)
**Source:** `src/app/actions/wearEvents.ts` lines 153-165 (`.list()`), 188-200 (`.remove()`); path convention in `src/lib/storage/wearPhotos.ts` lines 28-39
**Apply to:** `wipeCollection` AND `deleteAccount` in `account.ts`
- `.list(userId, { limit: 1000 })` then `.remove(paths)` — Supabase has no folder-delete.
- Paginate if > 1000 objects (RESEARCH Pitfall 3).
- Run BEFORE any DB delete (RESEARCH Pitfall 2).

### Email Color Tokens (Track B only)
**Source:** UI-SPEC §Email Color (no codebase analog — `oklch()` tokens in `globals.css` cannot be used)
**Apply to:** all `emails/*.tsx`
| Role | Hex |
|------|-----|
| Brand accent (wordmark + CTA bg) | `#D9A441` (VERIFY exact conversion of `--accent oklch(0.76 0.12 75)` — RESEARCH A4 flags as approximate) |
| Background | `#FFFFFF` |
| Heading text | `#111111` |
| Body text | `#444444` |
| Footer text | `#888888` |
| CTA text | `#FFFFFF` |
| Rule (`<Hr>`) | `#E5E5E5` |

## No Analog Found

Files with no close match in the codebase — planner uses RESEARCH.md §Pattern 4 / §Code Examples and UI-SPEC §Email Template Contract instead:

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `emails/components/HorloEmailLayout.tsx` | component (react-email) | static HTML | No email templates exist in the repo; greenfield. Follows react-email conventions, not CLAUDE.md `src/` conventions. |
| `emails/confirm-signup.tsx` | component (react-email) | static HTML | Same — greenfield. |
| `emails/reset-password.tsx` | component (react-email) | static HTML | Same — greenfield. |
| `emails/change-email.tsx` | component (react-email) | static HTML | Same — greenfield. |

Partial-analog note: `src/lib/supabase/admin.ts` has a *role-match* analog (`server.ts`) but the actual `createClient` construction is new — `server.ts` uses `@supabase/ssr` `createServerClient` (cookie-bound), the admin client uses the base SDK `createClient` (service-role). Copy the `import 'server-only'` guard and env-access style only.

## Metadata

**Analog search scope:** `src/lib/supabase/`, `src/app/actions/`, `src/components/settings/`, `src/lib/hooks/`, `src/lib/storage/`, `src/data/`, repo root
**Files scanned:** 14 (PasswordReauthDialog, AccountSection, EmailChangeForm, SettingsSection, server.ts, client.ts, auth.ts, actionTypes.ts, useFormFeedback.ts, wearEvents.ts, watches.ts action, watches.ts DAL, wearPhotos.ts, auth.ts action, tsconfig.json)
**Pattern extraction date:** 2026-05-15
```

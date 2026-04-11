---
dimension: pitfalls
generated: 2026-04-11
---
# Pitfalls Research

## Summary

The highest-risk areas for Horlo's planned upgrades are: (1) SSRF fix correctness — the most common "fix" (blocklisting by hostname string) is bypassed by DNS rebinding and alternate IP notations, requiring post-resolution validation; (2) auth middleware misplacement — Next.js 16 renamed `middleware.ts` to `proxy.ts` and the design intent is explicit: do coarse routing only, never trust it as the sole auth gate; (3) localStorage-to-cloud migration data loss — the watch IDs are currently generated with `Date.now() + random`, which will collide if a user imports existing data after the cloud schema is live. Dark mode and testing pitfalls are real but lower risk given the groundwork already in place.

---

## Dark Mode Pitfalls

### 1. The variant is already class-based — don't break it
**What goes wrong:** `globals.css` correctly declares `@custom-variant dark (&:is(.dark *))`, which makes `dark:` utilities respond to the `.dark` class on any ancestor. The pitfall is accidentally adding a second, conflicting dark configuration — for example by installing a component library or `next-themes` preset that also declares a `@custom-variant dark` or sets `darkMode: 'selector'` in a Tailwind plugin. Two competing variant declarations silently shadow one another; the last one wins but without a compile error.

**Warning signs:** Some `dark:` utilities stop responding even though `.dark` is on `<html>`. Usually noticed on newly added third-party components.

**Prevention:** Audit any new Tailwind plugin or shadcn component for its own dark variant declaration before installing. Keep the single source of truth in `globals.css`.

**Phase:** Visual milestone (dark mode phase).

---

### 2. Flash of incorrect theme on first load (FOUC)
**What goes wrong:** Next.js server-renders the HTML without knowing the user's stored preference. The page lands in light mode; the client reads `localStorage` and adds `.dark` to `<html>` during React hydration. The user sees a white flash even if they toggled dark the previous session.

**Warning signs:** A brief white flash on page load in dark mode, especially on slow connections or CPU-throttled devices.

**Prevention:** Inject a blocking inline `<script>` in the `<head>` (via `layout.tsx` or a custom `_document`) that reads `localStorage` and sets the class synchronously before the first paint. This script must run before React hydrates. `next-themes` handles this automatically if used; if rolling a custom toggle, the script placement is critical. Do not use a React `useEffect` — it always runs after paint.

**Example layout pattern:**
```tsx
// app/layout.tsx
<html suppressHydrationWarning>
  <head>
    <script dangerouslySetInnerHTML={{ __html: `
      (function() {
        var t = localStorage.getItem('theme');
        if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
          document.documentElement.classList.add('dark');
        }
      })();
    `}} />
  </head>
```

`suppressHydrationWarning` on `<html>` is required because the server renders no class but the client may add `dark` — React would otherwise warn about a hydration mismatch.

**Phase:** Visual milestone (dark mode phase).

---

### 3. System preference and manual toggle getting out of sync
**What goes wrong:** A toggle that writes to `localStorage` but doesn't also listen to `prefers-color-scheme` changes will diverge: system switches to light, app stays dark (or vice versa) because the stored value wins unconditionally. Conversely, a toggle that only wraps `prefers-color-scheme` ignores the user's explicit choice.

**Warning signs:** "I switched to dark but after the OS changed, the app changed too without asking."

**Prevention:** Implement a three-state model: `'light'` | `'dark'` | `'system'`. When state is `'system'`, apply the media query result and listen for changes. When state is `'light'` or `'dark'`, stored preference wins and media query changes are ignored. `next-themes` implements this model correctly out of the box.

**Phase:** Visual milestone (dark mode phase).

---

### 4. Hardcoded color values bypassing the CSS variable system
**What goes wrong:** A developer writes `bg-gray-900` instead of `bg-background` or `bg-card`. The hardcoded utility does not flip with the theme because it is not a CSS variable reference. This is especially common when copying code snippets from documentation that predates the project's token system.

**Warning signs:** A component looks fine in light mode but stays dark-gray in light mode (or stays white in dark mode).

**Prevention:** Enforce the semantic token system: always use `bg-background`, `text-foreground`, `bg-card`, `border-border`, etc., rather than raw palette utilities. Lint rule or PR review checklist. The existing `globals.css` defines the full token set in both `:root` and `.dark`.

**Phase:** Visual milestone (dark mode phase).

---

## Auth Integration Pitfalls

### 1. Next.js 16: `middleware.ts` is now `proxy.ts`
**What goes wrong:** Next.js 16 renamed the middleware entry point from `middleware.ts` to `proxy.ts` with a corresponding rename of the exported function from `middleware` to `proxy`. Auth guides written for Next.js 14/15 (including the current Auth.js docs) still reference `middleware.ts`. Using the old filename means the file is silently ignored — no error, no protection. Vercel ships a codemod: `npx @next/codemod@canary middleware-to-proxy`.

**Warning signs:** Protected routes are accessible without a session; no redirect occurs. `middleware.ts` exists but no execution evidence in logs.

**Prevention:** When scaffolding auth, create `proxy.ts` in `src/` (not `middleware.ts`). Run the Vercel codemod immediately after any upgrade from 15 → 16. Confirm the file is being executed with a test log before relying on it for auth.

**Phase:** Authentication milestone.

---

### 2. Proxy/middleware is not a sufficient auth gate — every server action and API route must re-verify
**What goes wrong:** CVE-2025-29927 (CVSS 9.1, patched in Next.js 15.2.3) demonstrated that an attacker who sends the `x-middleware-subrequest` header can bypass all middleware/proxy logic entirely. Even on patched versions, the architectural lesson stands: proxy/middleware runs at the edge and should only do coarse routing. Any API route, server action, or server component that handles real data must call `auth()` / `getServerSession()` independently. An app that relies solely on middleware redirection for protection will have unprotected Server Actions even after the SSRF fix and post-migration.

**Warning signs:** Server actions that mutate data (add/delete watches, update preferences) do not call `getServerSession()` internally.

**Prevention:** Rule: every server action and every API route that reads or writes user data calls the session helper and returns 401/403 before touching data. Middleware/proxy handles only the redirect UX for unauthenticated page visits.

**Phase:** Authentication milestone.

---

### 3. JWT vs database session strategy mismatch with Supabase or Prisma adapters
**What goes wrong:** Auth.js v5 database adapters (Supabase, Prisma, Drizzle) are incompatible with the Edge runtime. If `proxy.ts` calls the session function and the adapter tries to make a database connection, it throws at runtime. The common workaround — splitting the Auth.js config into two files — is not obvious and is poorly documented.

**Warning signs:** `TypeError: Cannot read properties of undefined` or edge runtime errors at startup when an adapter is configured.

**Prevention:** Use the split-config pattern: one `auth.config.ts` without adapter (edge-safe, used in `proxy.ts`) and one `auth.ts` with adapter (Node.js only, used in server components and actions). Force JWT strategy in the edge config.

```ts
// auth.config.ts (edge-safe, no adapter)
export const authConfig = { providers: [...], callbacks: { ... } }

// auth.ts (Node.js, has adapter)
import NextAuth from 'next-auth'
import { authConfig } from './auth.config'
import { SupabaseAdapter } from '@auth/supabase-adapter'
export const { auth, signIn, signOut } = NextAuth({ ...authConfig, adapter: SupabaseAdapter(...) })
```

**Phase:** Authentication milestone.

---

### 4. Missing `NEXTAUTH_SECRET` in production causes sessions to silently fail
**What goes wrong:** Without a valid `NEXTAUTH_SECRET` (32-byte random string), Auth.js falls back to an insecure or missing secret in development but throws or drops sessions in production. The failure mode is silent: logins appear to succeed but the session cookie is not set or is immediately invalid.

**Warning signs:** Login redirect succeeds but the user is immediately unauthenticated on the next request; `useSession()` returns `null` after sign-in.

**Prevention:** Generate the secret with `openssl rand -base64 32` before any deployment. Set it in `.env.local` and all deployment environment configs. Treat its absence as a startup-blocking error.

**Phase:** Authentication milestone.

---

### 5. Per-user data isolation must be enforced at query time, not inferred from session
**What goes wrong:** After migrating to multi-user, a naive implementation fetches the current user's watches by doing `WHERE userId = session.user.id` only in the frontend store. If a server action or API route accepts a watch ID from the client without verifying ownership, user A can mutate or read user B's watches by guessing or brute-forcing watch IDs. The current `generateId()` (timestamp + random) is not a security guarantee.

**Warning signs:** A server action like `deleteWatch(id)` accepts an `id` parameter and deletes without checking that the watch belongs to the session user.

**Prevention:** Every server-side data access must be scoped: `WHERE id = ? AND userId = auth().user.id`. Never trust client-supplied IDs as sufficient authorization.

**Phase:** Authentication milestone + Cloud persistence milestone.

---

## localStorage → Cloud Migration Pitfalls

### 1. Watch IDs generated with `Date.now()` will collide on import
**What goes wrong:** The current `generateId()` function produces `${Date.now()}-${random}`. When a user's localStorage data is exported and re-imported into the database (the migration path), multiple users doing this simultaneously or in rapid succession will produce different IDs that happen to share the timestamp prefix. More critically, if the migration script runs batch inserts, the IDs may collide in the database primary key column.

**Warning signs:** Insert errors on `UNIQUE constraint` during batch migration; two watches with identical IDs after import.

**Prevention:** Switch to `crypto.randomUUID()` (available in Node.js 14.17+ and modern browsers without a polyfill) for all new watch ID generation before or during the cloud migration. During the migration script, re-generate IDs for any record whose ID does not conform to UUID format.

**Phase:** Cloud persistence milestone.

---

### 2. No schema version on localStorage records means silent field corruption during migration
**What goes wrong:** The Zustand stores have no `version` field. If a new required field is added to the `Watch` type between when a user last synced and when migration runs, rehydrated records will have `undefined` for that field. The migration script will insert partially invalid records, which the app reads and crashes on later.

**Warning signs:** Zustand stores rehydrate but some watches are missing fields that the UI expects; runtime errors like `Cannot read properties of undefined` on field access.

**Prevention:** Add a store `version` field to both stores before any schema change. Write a migration function in the Zustand `persist` `onRehydrateStorage` callback that fills in missing fields with defaults. Confirm all records pass a Zod schema check before inserting into the database.

**Phase:** Cloud persistence milestone (must happen before any type changes).

---

### 3. The migration window creates a split-brain state
**What goes wrong:** The migration from localStorage to cloud is not atomic from the user's perspective. During the cutover (deploying the new cloud-backed build), existing users still have their collection only in localStorage. If the cloud schema is live but the migration hasn't run for their data, they log in and see an empty collection. If the migration fails halfway, some watches are in the DB and some remain only in localStorage.

**Warning signs:** Users report "lost my collection" after logging in; re-logging in doesn't help because the DB is empty or partial.

**Prevention:** (a) Build a self-service import flow — let users export their localStorage collection as JSON and import it into the cloud-backed account. Do not rely on an automated migration that runs once at deploy time. (b) Keep localStorage reads as a fallback for 30-60 days post-launch; if the cloud collection is empty on first login, prompt the user to import. (c) Never delete localStorage data automatically.

**Phase:** Cloud persistence milestone.

---

### 4. Zustand `persist` middleware and server-side rendering hydration mismatch
**What goes wrong:** Zustand's `persist` middleware reads from `localStorage` only on the client. With App Router server components, the server renders with the empty initial state, the client then hydrates with localStorage data. Any component that renders watch data on the server will show a flash of empty state. If components are not properly guarded with `useEffect` or `suppressHydrationWarning`, React will throw a hydration mismatch error.

**Warning signs:** Hydration error in the console: "Hydration failed because the server rendered HTML didn't match the client"; or a brief empty-state flash on load.

**Prevention:** Mark watch-data-rendering components as Client Components (`'use client'`). Use Zustand's built-in `useStore` hydration guard pattern, or check `typeof window !== 'undefined'` before rendering data-dependent UI. After the cloud migration, server components can fetch directly and this becomes a non-issue.

**Phase:** Cloud persistence milestone, but also relevant to any server-rendering work in the visual milestone.

---

### 5. Race condition between localStorage write and cloud write during transition period
**What goes wrong:** If a transition period runs where both localStorage and cloud are written (dual-write for safety), a network failure during the cloud write leaves the two stores diverged. On next load, the app reads cloud (the canonical source) and misses the latest change.

**Warning signs:** A watch the user just edited reverts to its previous state after a page reload.

**Prevention:** Designate a single source of truth from day one of the cloud rollout. Do not run dual-write in production. Instead, use the export/import flow (pitfall 3) for migration, then switch entirely to cloud. If dual-write is required for a rollback safety net, use a write-through pattern where cloud is written first and localStorage is updated only on success.

**Phase:** Cloud persistence milestone.

---

## Testing Next.js App Router Pitfalls

### 1. Async React Server Components cannot be unit-tested with Vitest + RTL
**What goes wrong:** Vitest and React Testing Library do not support rendering async Server Components (components that use `async/await` at the top level). Attempting to render them throws an error about async rendering not being supported in the test environment. This affects any component that fetches data directly (which will be common post-cloud migration).

**Warning signs:** `Error: Objects are not valid as a React child (found: [object Promise])` when rendering a Server Component in RTL.

**Prevention:** Unit-test Server Components by testing their data-fetching logic (the fetch/query function) and their rendering logic separately. Use Playwright or Cypress for E2E tests that verify the integrated server-rendered output. For Horlo specifically, the similarity engine, extractor pipeline, and Zustand store reducers are all pure functions — test those directly without rendering.

**Phase:** Quality milestone.

---

### 2. `next/navigation` hooks require explicit mocking — `next/router` does not work
**What goes wrong:** App Router components use `useRouter`, `usePathname`, and `useSearchParams` from `next/navigation`. In tests, these throw if the Next.js router context is not provided. Using `next-router-mock` (which mocks `next/router`) does not solve this; it mocks the wrong module.

**Warning signs:** `Error: invariant expected app router to be mounted` when rendering a component that calls `useRouter()`.

**Prevention:** Mock `next/navigation` using `vi.mock`:
```ts
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}))
```
Use `vi.hoisted()` if the mock must be initialized before imports are resolved. The `next-router-mock` library supports `next/navigation` as of recent versions — verify the version before relying on it.

**Phase:** Quality milestone.

---

### 3. Testing Zustand stores without resetting state between tests causes pollution
**What goes wrong:** Zustand stores are module-level singletons. If one test adds a watch to the store and doesn't reset it, the next test starts with that watch already present. Test order matters and tests become interdependent, producing false passes and false failures.

**Warning signs:** Tests pass individually but fail when run together; a test that asserts an empty collection fails randomly.

**Prevention:** Reset the store before each test:
```ts
beforeEach(() => {
  useWatchStore.setState({ watches: [], filters: defaultFilters })
})
```
Alternatively, use Zustand's `create` with a factory pattern so each test gets a fresh store instance. Add a `resetStore()` action to both stores for convenience in tests.

**Phase:** Quality milestone.

---

### 4. Testing the LLM extractor pipeline with real API calls is slow, flaky, and expensive
**What goes wrong:** `fetchAndExtract` makes real HTTP requests and optionally calls the Anthropic API. If tests call this without mocking, they are slow (network-dependent), flaky (LLM responses are non-deterministic), and expensive (paid API calls on every test run).

**Warning signs:** Test suite takes 30+ seconds; occasional timeouts on CI; Anthropic billing surprises.

**Prevention:** Mock at the network boundary. Use `vi.mock('@/lib/extractors')` with fixture responses that represent each extractor stage. Test the three stages (structured data, HTML selectors, LLM fallback) independently with canned inputs. The integration test for the full pipeline should run in a separate, clearly labelled suite that is gated by an environment variable and never runs on every commit.

**Phase:** Quality milestone.

---

### 5. Snapshot tests on complex components generate noise and erode trust
**What goes wrong:** Snapshot tests on `WatchCard`, `WatchDetail`, or the filter bar will fail on every intentional UI change (spacing, icon swap, wording). Developers begin running `vitest --update-snapshots` reflexively without reviewing the diff, making the snapshots meaningless security theater.

**Warning signs:** Snapshot update PRs with no description; snapshots updated in the same commit as UI changes.

**Prevention:** Do not snapshot complex, frequently-changing components. Reserve snapshot tests for stable, primitive components (e.g., a static badge or icon). For UI components, test behavior: does clicking the status toggle call `updateWatch`? Does the filter bar render the correct count? Use RTL queries (`getByRole`, `getByText`) over snapshots.

**Phase:** Quality milestone.

---

## SSRF Fix Pitfalls

### 1. Hostname blocklist matching is bypassed by alternate IP notations
**What goes wrong:** The most common "fix" is a string check: reject URLs where the hostname is `localhost`, `127.0.0.1`, or `::1`. Attackers bypass this trivially with:
- Decimal integer notation: `http://2130706433/` (= `127.0.0.1`)
- Hex notation: `http://0x7f000001/`
- Octal: `http://0177.0.0.1/`
- IPv6-mapped: `http://[::ffff:127.0.0.1]/`
- URL-encoded or padded variants

**Warning signs:** The fix only checks `parsedUrl.hostname` as a string without resolving it to a canonical IP.

**Prevention:** After parsing the URL, resolve the hostname to an IP address (DNS lookup), then validate the resolved IP is not in a private/reserved range. Use a library like `is-ip` + RFC 1918/5735 range checks, or use the `ssrf-req-filter` npm package which handles normalization. Validate the IP after resolution, not the hostname string.

**Phase:** This is an active security issue; fix before auth ships. The SSRF endpoint is currently unauthenticated, so it is public.

---

### 2. DNS rebinding bypasses pre-flight IP validation
**What goes wrong:** The code resolves the hostname to validate the IP, then makes the actual HTTP request. Between those two events, a malicious DNS record (with a very short TTL) can return a private IP for the second lookup, routing the request to an internal resource even though the validation passed.

**Warning signs:** Validation resolves to a public IP, but the actual `fetch()` call uses the OS DNS cache which has been poisoned.

**Prevention:** Resolve the hostname once, validate the resulting IP, then force the HTTP request to use that resolved IP directly (not the hostname). In Node.js, this means using a custom DNS resolver in the `fetch` call or using the `got` library with `dnsCache: false` and a `beforeRequest` hook that pins the resolved address. Alternatively, use a dedicated library (`ssrf-req-filter`, `safe-ssrf`) that handles this correctly.

**Phase:** Same as above — fix before auth ships.

---

### 3. HTTP redirects can route a validated request to an internal address
**What goes wrong:** The server validates that `https://example.com/watch` is a safe URL, fetches it, and the server at `example.com` responds with a 301 redirect to `http://192.168.1.1/admin`. The follow-redirect behavior of `fetch` (or Node's `https`) will follow the redirect to the internal address without re-validating.

**Warning signs:** The fetch utility uses `redirect: 'follow'` (the default) without checking intermediate or final URLs.

**Prevention:** Intercept redirects and validate each destination URL before following. Use `redirect: 'manual'` in `fetch`, inspect the `Location` header, validate it against the same blocklist, then decide whether to follow. Or use a library that handles this (`ssrf-req-filter` validates the entire redirect chain).

**Phase:** Same as above — fix before auth ships.

---

### 4. Adding auth to the extract route is necessary but not sufficient
**What goes wrong:** When auth is added, a team marks the SSRF issue "resolved" because only authenticated users can call the endpoint. But authenticated users can still use the endpoint to probe internal infrastructure on the server's network — cloud metadata endpoints (`169.254.169.254` — AWS/GCP instance metadata), internal database hosts, or adjacent services. The vulnerability shifts from external to internal threat actor.

**Warning signs:** PR description says "fixed SSRF by adding auth gate." No IP blocklist or redirect-chain validation is present.

**Prevention:** Auth reduces the attack surface but does not eliminate the SSRF risk. IP validation (pitfalls 1-3) is still required even after auth is added. The two fixes are complementary, not alternatives.

**Phase:** Authentication milestone should not mark SSRF as closed. Treat them as separate tracks.

---

### 5. Unvalidated image URLs are a separate, ongoing injection vector
**What goes wrong:** `watch.imageUrl` is rendered as a raw `<img src>` in `WatchCard.tsx` and `WatchDetail.tsx`. This enables tracking pixels (any domain can log when the image is loaded), potential CSRF via credentialed image requests, and arbitrary content from untrusted origins. The SSRF fix on the API route does not address this.

**Warning signs:** `<img src={watch.imageUrl}>` without a domain allowlist or `next/image` wrapper.

**Prevention:** Replace raw `<img>` with Next.js `<Image>` component. Configure `remotePatterns` in `next.config.ts` to allowlist domains (e.g., `*.watchuseek.com`, `*.hodinkee.com`). For URLs outside the allowlist, render a placeholder instead of the user-supplied URL. Additionally, validate and sanitize `imageUrl` before persisting it (at the point of extraction or user input).

**Phase:** Visual milestone (can do it alongside the image/card polish) — but treat as a security fix, not a style fix.

---

## Phase-Specific Warnings Summary

| Phase | Topic | Highest-Risk Pitfall | Mitigation |
|-------|-------|---------------------|------------|
| Visual milestone | Dark mode | FOUC on SSR page load | Blocking inline script in `<head>` before hydration |
| Visual milestone | Image rendering | Unvalidated `imageUrl` as `<img src>` | Switch to `next/image` with `remotePatterns` allowlist |
| Auth milestone | Proxy setup | `middleware.ts` silently ignored in Next.js 16 | File must be named `proxy.ts`; run the Vercel codemod |
| Auth milestone | Auth gate | Proxy bypass via CVE-2025-29927 pattern | Every server action re-verifies session independently |
| Auth milestone | Data isolation | Watch ownership not enforced server-side | Scope all queries to `userId = auth().user.id` |
| Cloud persistence | Migration | Split-brain / lost collection at cutover | Self-service export/import; never auto-delete localStorage |
| Cloud persistence | ID collisions | `Date.now()` IDs collide on batch import | Switch to `crypto.randomUUID()` before migration |
| Cloud persistence | Schema gaps | No version field; `undefined` fields on rehydration | Zustand `onRehydrateStorage` migration + Zod validation |
| Quality milestone | RSC testing | Async Server Components unrenderable in RTL | Test logic in isolation; use E2E for integrated RSC output |
| Quality milestone | Store pollution | Zustand singletons retain state between tests | `beforeEach` store reset |
| SSRF fix | URL validation | String-match blocklist bypassed by IP notation variants | Resolve hostname, validate resolved IP, pin for request |
| SSRF fix | Redirect chain | HTTP 3xx redirects route validated request to internal IP | `redirect: 'manual'`; validate each hop |

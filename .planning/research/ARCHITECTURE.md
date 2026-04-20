---
dimension: architecture
generated: 2026-04-11
---
# Architecture Research

## Summary

The Next.js 16 App Router canonical pattern for cloud-persisted multi-user apps is a Data Access Layer (DAL) called from Server Components for reads and thin Server Actions for writes — not API routes, which are reserved for external consumers. Zustand's role narrows to ephemeral UI state (filter selections, open modals) while the collection and preferences data moves to the server. The similarity engine is a pure client-side scoring function that should stay in the browser: it scores against already-fetched data and has no secret-access requirement.

---

## Recommended Data Access Pattern

### Ruling: DAL + Server Actions, not API Routes

The official Next.js 16 docs (node_modules/next/dist/docs/01-app/02-guides/data-security.md) state three options: External HTTP APIs (existing large projects), Data Access Layer (new projects), Component-level (prototypes). Horlo's migration should use the DAL pattern.

**What the DAL does:**
- Lives in `src/data/` (or `src/lib/data/`), marked `import 'server-only'` at the top of every file.
- Checks authentication and authorization before every read and write.
- Returns minimal Data Transfer Objects (DTOs) — only the fields the UI needs, not raw DB rows.
- Uses React's `cache()` so `getCurrentUser()` is called at most once per request even if multiple Server Components invoke it.

**Server Actions are thin wrappers:**
- `'use server'` files in `src/app/actions/` delegate immediately to the DAL.
- Actions handle `revalidatePath()` / `revalidateTag()` after mutations.
- Actions never contain business logic; they call the DAL function and return only what the UI needs.

**API Routes stay narrow:**
- The existing `POST /api/extract-watch` route is a proxy to external URLs — that is exactly what Route Handlers are for (external-facing, not internal data access).
- No new API routes are needed for watch CRUD or preferences; Server Actions cover those.

**Official guidance (Feb 2025 Next.js blog, "Building APIs with Next.js"):**
> "If you only need server-side data fetching for your own Next.js app (and you don't need to share that data externally), Server Components might be sufficient to fetch data directly during render — no separate API layer is required."

### Concrete layer structure after migration

```
src/
  data/                         # DAL — server-only
    auth.ts                     # getCurrentUser() wrapped in cache()
    watches.ts                  # getWatchesForUser(), getWatchById(), etc.
    preferences.ts              # getPreferencesForUser()

  app/
    actions/
      watches.ts                # addWatch(), updateWatch(), deleteWatch()
      preferences.ts            # updatePreferences()
      auth.ts                   # signup(), login(), logout()

    (collection)/page.tsx       # Server Component — calls DAL directly, renders data
    watch/[id]/page.tsx         # Server Component — calls getWatchById()
    insights/page.tsx           # Server Component — calls getWatchesForUser()
    preferences/page.tsx        # Server Component — calls getPreferencesForUser()
```

---

## Migration Strategy

### The challenge

Users have collection data in `localStorage["watch-collection"]` and preferences in `localStorage["user-preferences"]`. There is no server account. On first sign-in, their data must move to the database, or it is lost.

### Recommended approach: "Import on first login"

**Phase A — Auth exists, import is voluntary**

1. User signs up or logs in. An empty server collection is created.
2. A Client Component (run in browser) reads `localStorage["watch-collection"]`.
3. If data is present, a dismissable banner appears: "You have X watches saved locally. Import them to your account?"
4. User clicks Import. A Server Action `importFromLocalStorage(watches)` receives the parsed JSON, validates each watch against the `Watch` schema (Zod), and bulk-inserts into the database.
5. On success, the banner confirms completion and localStorage keys are cleared.
6. If user dismisses the banner, localStorage is left intact and the prompt does not reappear (tracked via a `imported_local` flag in the user's DB record).

**Why not automatic silent migration:**
- Silent migration that fails mid-way leaves the user in an ambiguous state.
- Showing a banner gives the user agency and makes data import auditable.
- Some users may intentionally want to start fresh with an empty server collection.

**Phase B — localStorage fallback removed**

After the import window (one release cycle), remove the Zustand `persist` middleware from `watchStore` and `preferencesStore`. The stores become ephemeral UI-only state.

### Schema compatibility

The existing `Watch` and `UserPreferences` TypeScript types become the basis for the database schema. Extend rather than replace:
- Add `userId: string` (foreign key) to each watch row.
- Add `createdAt`, `updatedAt` timestamps.
- `id` is already present on `Watch` — map it to the database primary key.
- `UserPreferences` becomes a one-to-one table with `userId`.

Zod schemas should validate the localStorage JSON during import to catch any corruption before it hits the database.

---

## Session + Auth Integration

### How sessions work in App Router

From the official Next.js 16 auth guide, sessions can be stateless (JWT in an HttpOnly cookie) or database-backed (session ID in cookie, session data in DB). For Horlo's scale (<500 watches per user, personal-first), a stateless JWT session stored in an HttpOnly cookie is simpler and sufficient.

**Critical security finding (CVE-2025-29927 context):**
Middleware alone is NOT a security boundary. Middleware runs at the edge and can be bypassed. Authentication must be verified at every data access point inside the DAL.

### Session flow

```
Request arrives
  │
  ├── middleware.ts                  # Edge: fast redirect if no session cookie
  │     └── checks cookie presence only — NOT a security gate
  │
  └── Server Component renders
        │
        └── calls DAL function
              │
              └── getCurrentUser()   # Decrypts cookie, validates JWT
                    │                # Redirects to /login if invalid
                    └── returns { userId, ... }
                          │
                          └── DB query scoped to userId
```

**`getCurrentUser()` pattern (from official docs):**

```typescript
// src/data/auth.ts
import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'

export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get('session')?.value
  const session = await decryptAndValidate(token)
  if (!session?.userId) redirect('/login')
  return { userId: session.userId }
})
```

`cache()` ensures the session is decrypted once per render even if five Server Components call `getCurrentUser()`.

### Server Components vs Client Components

**Server Components** (the majority of Horlo's pages after migration):
- Can call `getCurrentUser()` and the DAL directly.
- Never receive raw session tokens.
- Pass only safe DTOs down to Client Components as props.

**Client Components** (interactive UI: FilterBar, WatchForm, UrlImport, similarity display):
- Cannot access session tokens or the DAL.
- Receive data as props from their Server Component parent, or call Server Actions for mutations.
- Zustand stores in Client Components hold ephemeral UI state only (filter selections, modal open/close state).

**What Zustand becomes after migration:**
- `watchStore`: Remove `persist`, remove CRUD methods. Keep only filter state (selectedStatus, activeStyleTags, etc.).
- `preferencesStore`: Remove entirely or reduce to a local cache of the last-fetched preferences for Client Component reads. The source of truth is the database.

**Do not pass session data to Client Components.** The official Next.js docs flag this explicitly: anything passed from a Server Component to a Client Component is serialized into the browser JS bundle.

### Auth library recommendation

The official docs recommend using an auth library rather than rolling a custom session. For Horlo, **NextAuth.js v5 (Auth.js)** or **Better Auth** are the current options:

- NextAuth.js v5 is fully redesigned for App Router, supports Server Actions, and uses the `auth()` helper inside Server Components.
- Better Auth is a newer, type-safe alternative with a cleaner API.

Either works. NextAuth.js v5 has broader community adoption and more examples for App Router patterns as of 2026.

---

## Similarity Engine Placement

**Verdict: keep client-side. Confidence: HIGH.**

The similarity engine (`src/lib/similarity.ts`) is a pure scoring function. It takes a target watch, the user's collection, and preferences as inputs, and returns a `SimilarityResult`. It has no I/O.

**Reasons to keep it in the browser:**

1. **No server secrets needed.** The function does not call external APIs or access environment variables. Moving it server-side provides no security benefit.

2. **Data is already in the browser.** After the server renders the collection page, watch data is passed to Client Components as props. Running the similarity engine on that already-resident data costs zero additional network round trips.

3. **Interactivity requirement.** Similarity analysis is triggered by user actions (selecting a watch, navigating to the insights page). A client-side function responds instantly; a server round-trip would add latency with no gain.

4. **No meaningful compute cost.** At <500 watches per user, the 8-dimension weighted scoring runs in milliseconds in the browser. This is not a workload that benefits from server offloading.

5. **Server-side would require hydration plumbing.** Moving to a Server Action or API route would require serializing the collection, shipping it to the server, scoring it there, and sending results back. That is strictly more work for no benefit.

**What changes after migration:** The similarity engine currently reads from `useWatchStore()`. After migration, the collection data is passed as props from the Server Component parent. The engine's API does not need to change — only how the calling component obtains the collection array changes.

---

## Component Boundaries After Migration

```
Server Components (run on server, access DAL directly)
┌─────────────────────────────────────────────────────────────────────┐
│  app/(collection)/page.tsx                                          │
│    └── getWatchesForUser(userId) → Watch[]                          │
│          └── passes watches[], preferences as props                 │
│                                                                     │
│  app/watch/[id]/page.tsx                                            │
│    └── getWatchById(userId, watchId) → Watch                        │
│                                                                     │
│  app/insights/page.tsx                                              │
│    └── getWatchesForUser(userId) + getPreferencesForUser(userId)    │
│                                                                     │
│  app/preferences/page.tsx                                           │
│    └── getPreferencesForUser(userId) → UserPreferences              │
└─────────────────────────────────────────────────────────────────────┘
         │ props (safe DTOs only)
         ▼
Client Component Islands (run in browser, no DAL access)
┌─────────────────────────────────────────────────────────────────────┐
│  WatchGrid.tsx          ← receives Watch[] as prop                  │
│  FilterBar.tsx          ← reads/writes Zustand filter state         │
│  WatchCard.tsx          ← pure display                              │
│  WatchDetail.tsx        ← receives Watch as prop                    │
│  WatchForm.tsx          ← calls addWatch() / updateWatch() actions  │
│  UrlImport.tsx          ← calls POST /api/extract-watch             │
│  SimilarityBadge.tsx    ← runs similarity.ts locally                │
│  BalanceChart.tsx       ← pure computation on prop data             │
│  LocalStorageImport.tsx ← reads localStorage, calls import action   │
└─────────────────────────────────────────────────────────────────────┘
         │ Server Actions (encrypted POST, no explicit fetch)
         ▼
Server Actions → DAL
┌─────────────────────────────────────────────────────────────────────┐
│  actions/watches.ts → data/watches.ts → database                   │
│  actions/preferences.ts → data/preferences.ts → database           │
│  actions/auth.ts → data/auth.ts → session cookie                   │
└─────────────────────────────────────────────────────────────────────┘

Separate (unchanged role):
  POST /api/extract-watch  ← external URL proxy, NOT internal data
```

**Communication rules:**
- Server Components talk to DAL directly; they do not call Server Actions (those are for Client Components).
- Client Components pass data up via Server Actions only; they never call the DAL.
- The similarity engine runs inside Client Components and receives its inputs as props, not from the store.
- The extraction route remains a Route Handler because it proxies an external resource — this is the correct use of API routes per official Next.js guidance.

---

## Build Order

Dependencies must be built in this order. Each phase unlocks the next.

### Phase 1 — Database schema + DAL foundation
**Unlocks:** Everything. Nothing else can land without a working database and data layer.
- Choose ORM (Drizzle or Prisma; see STACK.md)
- Define schema for `users`, `watches`, `user_preferences`
- Implement DAL: `getCurrentUser()`, `getWatchesForUser()`, `getWatchById()`, `getPreferencesForUser()`
- Implement Server Actions for watch CRUD and preference updates
- No UI changes yet; connect existing pages to DAL reads

**Dependency:** None.

### Phase 2 — Auth (signup, login, sessions)
**Unlocks:** User isolation, data security, the import flow.
- Install and configure NextAuth.js v5 or Better Auth
- Implement signup and login forms (Server Actions)
- Session middleware (cookie-based, stateless JWT)
- `getCurrentUser()` becomes non-stub — reads actual session
- Protect all pages and Server Actions with auth checks
- Fix SSRF on `/api/extract-watch` (add auth check and IP allowlist) — this is a security blocker that must land with auth, not after

**Dependency:** Phase 1 (DAL must exist before auth can scope queries to userId).

### Phase 3 — localStorage migration / import flow
**Unlocks:** Existing users' data preserved; Zustand can be cleaned up.
- `LocalStorageImport.tsx` Client Component reads `localStorage["watch-collection"]`
- Validates against Zod `Watch` schema
- Calls `importFromLocalStorage(watches[])` Server Action → DAL bulk insert
- One-time banner UI with dismiss + confirmation states
- After successful import, clear localStorage keys
- Remove `persist` middleware from Zustand stores
- Zustand `watchStore` becomes filter-only state; `preferencesStore` removed or becomes UI cache

**Dependency:** Phase 2 (users must exist before they can own watches).

### Phase 4 — Similarity engine re-wiring
**Unlocks:** Insights and similarity features working against server data.
- `SimilarityBadge.tsx` and `BalanceChart.tsx` receive collection + preferences as props from Server Components (instead of pulling from Zustand)
- `analyzeSimilarity()` in `similarity.ts` unchanged — only the call site changes
- `insights/page.tsx` becomes a Server Component that fetches collection + preferences, then passes to Client Component charts/badges

**Dependency:** Phase 3 (Zustand stores gone; data comes from props).

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| DAL + Server Actions pattern | HIGH | Verified in official Next.js 16 docs (node_modules/next/dist/docs/01-app/02-guides/data-security.md) |
| Session handling (middleware not sufficient) | HIGH | Verified in official Next.js 16 docs; CVE-2025-29927 confirms |
| Similarity engine client-side | HIGH | Pure function, no I/O, already resident data — architectural logic is sound |
| Import-on-login migration strategy | MEDIUM | General pattern is established; exact UX flow is a product decision |
| Auth library choice (NextAuth.js v5 vs Better Auth) | MEDIUM | Community adoption data from WebSearch; official comparison not benchmarked |
| Build order phase dependencies | HIGH | Logical dependencies are clear from architectural constraints |

---

## Sources

- Next.js 16 official docs (local): `node_modules/next/dist/docs/01-app/02-guides/data-security.md`
- Next.js 16 official docs (local): `node_modules/next/dist/docs/01-app/02-guides/authentication.md`
- Next.js blog, "Building APIs with Next.js" (Feb 2025): https://nextjs.org/blog/building-apis-with-nextjs
- WorkOS, "Building authentication in Next.js App Router: The complete guide for 2026": https://workos.com/blog/nextjs-app-router-authentication-guide-2026
- Next.js docs, "Guides: Data Security": https://nextjs.org/docs/app/guides/data-security

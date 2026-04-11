---
dimension: stack
generated: 2026-04-11
---
# Stack Research

## Summary

Horlo needs four technology additions to its existing Next.js 16 / React 19 / Tailwind CSS 4 base: class-based dark mode via `@custom-variant` + `next-themes`, server-side auth via Supabase Auth (which bundles well with the database choice), a Postgres database on Neon with Drizzle ORM, and a Vitest + React Testing Library unit test setup. Each choice favors minimal vendor surface area, strong App Router support, and a free tier that fits a personal-use app with fewer than 500 records per user.

---

## Dark Mode (Tailwind CSS 4)

### How Tailwind CSS 4 dark mode works

Tailwind CSS 4 removed `tailwind.config.js` entirely. The `darkMode: 'class'` config key no longer exists. Instead, dark mode variant behavior is defined in CSS using the `@custom-variant` directive.

**Default behavior (no config):** `dark:` utilities respond to the OS `prefers-color-scheme` media query automatically. No CSS change needed.

**Class-based override (required for a toggle button):** Add one line to `src/app/globals.css`:

```css
@custom-variant dark (&:where(.dark, .dark *));
```

This makes `dark:` utilities activate when any ancestor element carries the `.dark` class, which is the pattern `next-themes` writes to `<html>`.

### Recommended approach

Use **`next-themes`** to manage the `dark` class on `<html>`.

- Wraps `children` in a `ThemeProvider` in the root layout (client boundary).
- Persists preference to `localStorage`.
- Reads system preference on first visit.
- Eliminates flash-of-wrong-theme on hydration when using `suppressHydrationWarning` on `<html>`.
- Battle-tested with Next.js App Router; the Zustand team member who wrote the library (pacocoursey) maintains it actively.

**Note:** Theme toggle UI components must be wrapped in a `mounted` check or `dynamic(() => import(...), { ssr: false })` to avoid hydration mismatches, because the server cannot know the user's preference at render time.

**Confidence:** HIGH — Tailwind official docs confirm `@custom-variant` is the v4 API. `next-themes` is the dominant community solution for Next.js App Router dark mode (multiple independent sources confirm the combination works as described).

---

## Auth Provider

### Comparison

| Criterion | Better Auth | Clerk | Supabase Auth | Auth.js v5 |
|-----------|-------------|-------|---------------|------------|
| App Router support | Native, first-class | Native, first-class | Via `@supabase/ssr` + middleware | Via `auth()` universal helper |
| Setup complexity | Low — TypeScript-first, good DX | Very low — prebuilt UI components | Medium — requires two client types (server + browser) + middleware | Medium — credential flows are notoriously fiddly |
| Built-in UI | No (bring your own) | Yes (hosted or embedded) | No | No |
| OAuth providers | Yes | Yes (Google, GitHub, etc.) | Yes | Yes |
| Email/password | Yes | Yes | Yes | Yes |
| MFA / passkeys | Plugin system | Built-in | Basic | Manual |
| Free tier | Self-hosted = free | 50,000 MRU/month | 50,000 MAU/month | Self-hosted = free |
| Vendor lock-in | None (self-hosted) | High — Clerk manages user data | Medium — Supabase-hosted | None |
| Ecosystem momentum | Rising fast; Auth.js team joined project Sept 2025 | Established, strong Next.js presence | Established, tied to Supabase platform | Declining — team moved to Better Auth |
| Data ownership | Full | None | Full (your Supabase project) | Full |

### Recommendation

**Supabase Auth** — because Horlo is already moving to a database, and Supabase Auth + Supabase Postgres is a single-vendor bundle with a unified free tier. Row Level Security (RLS) handles per-user data isolation at the database layer, which means authorization is not a separate implementation concern. `@supabase/ssr` has first-class Next.js App Router support with documented patterns for server components, server actions, and middleware session refresh.

**Do not use Clerk.** Clerk is the fastest path to auth UI, but it means Clerk controls your user identities. For a personal tool being migrated to multi-user, that trade-off is not worth it — especially since Horlo's auth UI surface is small (login, signup, logout).

**Do not use Auth.js v5 / NextAuth v5.** The Auth.js maintainer team formally moved to Better Auth in September 2025. Auth.js will receive security patches but is not the forward path. It also has a known poor DX for credential-based auth flows.

**Better Auth** is the strongest self-hosted alternative if you want to use a different database later. It is TypeScript-first, has better DX than Auth.js, and is now the community-endorsed successor. However, it does not bundle with a database, so you would configure it alongside Neon separately. If the team later wants to move off Supabase, Better Auth + Neon is the cleanest upgrade path.

**Confidence:** MEDIUM — Supabase Auth + Next.js App Router is well-documented and widely used. The "Auth.js team joined Better Auth" claim is from multiple secondary sources (September 2025); the official announcement was not directly verified against primary sources, but the community signal is consistent.

---

## Database / Persistence

### Comparison

| Criterion | Supabase (Postgres) | Neon (Postgres) | Turso (SQLite/libSQL) | PlanetScale (MySQL) |
|-----------|--------------------|-----------------|-----------------------|---------------------|
| Engine | Postgres | Postgres | SQLite (libSQL) | MySQL (Vitess) |
| Free tier storage | 500 MB + 1 GB file | 0.5 GB / branch, 5 GB total | 5 GB shared | Free tier discontinued 2024 |
| Free tier projects | 2 per org | 20 | 100 databases | N/A |
| Cold start | ~10-30s pause on free (no pause on paid) | ~500ms (scale-to-zero) | None (scale-to-zero deprecated Jan 2026) | N/A |
| ORM support | Drizzle, Prisma | Drizzle, Prisma | Drizzle, Prisma | Drizzle, Prisma |
| Branching for preview deploys | No | Yes — first-class | No | No |
| Auth bundling | Yes (Supabase Auth) | No (bring your own) | No | No |
| DX with Next.js | Good — official guides | Good — `@neondatabase/serverless` driver | Good — `@libsql/client` | N/A |
| Pricing at scale | $25/mo (Pro) | Pay-as-you-go | Pay-as-you-go | N/A |

**Do not use PlanetScale.** Its free tier was discontinued in 2024.

**Do not use Turso.** SQLite is the right fit for edge/read-heavy/embedded scenarios. Horlo is a standard web app reading and writing from a single region. Postgres is the correct choice; SQLite adds operational complexity without a meaningful benefit at this scale.

### Recommendation

**Neon (Postgres) + Drizzle ORM** — unless going all-in on Supabase for auth too.

If Supabase Auth is chosen: use **Supabase Postgres** directly. Running auth and data in the same Supabase project means a single dashboard, single connection string, and RLS policies that span both. The combined free tier (50K MAU + 500 MB storage) is more than sufficient for a personal watch collection.

If the team wants flexibility to swap auth later: use **Neon**. Neon has the better pure-database free tier (20 projects, database branching for preview environments), faster cold starts (~500ms vs Supabase's 10-30s on free), and is purpose-built for serverless Postgres. It pairs naturally with Better Auth.

**ORM: Drizzle** over Prisma for this project because:
- Bundle size: ~7.4 KB (gzip) vs Prisma's ~1.6 MB. Matters for edge functions and cold starts.
- Code-first: schema defined in TypeScript, no separate `.prisma` DSL to learn.
- Drizzle is now the default ORM choice in new t3-app projects (early 2026).
- For <500 rows per user, Drizzle's migration tooling (`drizzle-kit`) is sufficient; Prisma's automated migrations are only a meaningful advantage on larger teams with complex schema churn.

**Confidence:** HIGH for Neon/Supabase choice — both are well-documented and widely used with Next.js. HIGH for Drizzle over Prisma — bundle size and ecosystem momentum are documented facts. MEDIUM for Supabase Auth + Supabase Postgres bundling benefit — well-supported in docs but assumes the team will not need to swap auth providers later.

---

## Testing Stack

### Recommendation: Vitest + React Testing Library + MSW

**Test runner: Vitest** — not Jest.

Rationale:
- Next.js 16 App Router officially documents Vitest as the unit testing path (confirmed in `node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md`).
- The project uses ESM throughout (TypeScript, Tailwind 4, Next.js 16). Vitest handles ESM natively; Jest requires `babel-jest` or `ts-jest` configuration that adds friction.
- Vitest's API (`describe`, `it`, `expect`, `beforeEach`) is Jest-compatible — migration cost is near-zero if tests already existed.
- Vitest runs 4-5x faster than Jest in benchmarks on comparable suites.

**Component testing: `@testing-library/react`** — the standard; no alternative needed.

**Network mocking: MSW (Mock Service Worker)** — for testing Route Handlers and components that call `/api/extract-watch`. MSW intercepts at the network level, so application code does not need to change between test and production environments.

**What Vitest does NOT cover:**
- `async` Server Components — Vitest cannot render them. This is a documented React ecosystem limitation. Test async server components with Playwright E2E tests, or restructure them to extract logic into pure functions that can be unit tested separately.
- Route Handlers — can be tested by calling the handler function directly (import and invoke), or via Playwright. MSW is not needed for direct invocation.

### Package install

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths @testing-library/user-event msw
```

### Zustand store testing pattern

Zustand 5 stores can be tested by importing and calling store actions directly (no React render needed for pure logic). The official Zustand docs recommend creating a `__mocks__/zustand.ts` that resets store state between tests. For component tests that depend on store state, wrap with a real store instance rather than mocking — this tests the integration more honestly.

**Confidence:** HIGH — testing stack is directly documented in Next.js 16 source docs. Vitest setup is the officially recommended path. Zustand testing pattern is from official Zustand docs.

---

## Confidence

| Area | Level | Reason |
|------|-------|--------|
| Dark mode (Tailwind 4 + next-themes) | HIGH | Tailwind official docs confirm `@custom-variant` API; next-themes pattern confirmed across multiple independent sources |
| Auth (Supabase Auth recommendation) | MEDIUM | Auth.js → Better Auth transition confirmed across multiple sources but not from a primary Vercel/Auth.js official announcement; Supabase Auth + Next.js integration well-documented |
| Database (Neon + Drizzle) | HIGH | Free tier limits confirmed from Neon docs; Drizzle bundle size and ecosystem momentum confirmed from multiple sources |
| Testing (Vitest + RTL) | HIGH | Directly documented in Next.js 16 bundled docs (`node_modules/next/dist/docs/`) |

### Caveats

- **Auth.js team joining Better Auth (Sept 2025):** This claim appears in multiple community sources but was not verified against a primary Vercel or Auth.js announcement. Treat Better Auth as the rising choice, but do a quick verification before committing to the recommendation in the roadmap.
- **Supabase free tier cold starts:** The 10-30s pause on the free plan is a known limitation but Supabase may have improved it. Verify before recommending for production use if Supabase is chosen.
- **Turso scale-to-zero deprecation (Jan 2026):** Cited in search results but not verified against Turso official docs. Turso is not the recommendation regardless, so this is low impact.

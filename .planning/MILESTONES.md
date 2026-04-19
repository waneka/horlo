# Milestones

## v1.0 MVP (Shipped: 2026-04-19)

**Phases completed:** 5 of 6 phases, 26 plans, 36 tasks
**Timeline:** 5 days (2026-04-10 → 2026-04-15)
**Scope:** 222 files changed, ~45k lines, 7,958 LOC TypeScript
**Git range:** 157 commits (588f47c → b3e547b)
**Tests:** 697 passing, 3 skipped (18 test files)

**Key accomplishments:**

1. **Visual polish & security hardening** — Theme system (light/dark/system), fully responsive layouts, SSRF protection with IP pinning, CSP headers, `next/image` domain allowlist, days-since-worn badges, collection balance charts
2. **Preference-aware scoring** — `complicationExceptions`, `collectionGoal` (balanced/specialist/variety), and gap-fill scoring wired into the similarity engine with full Vitest coverage
3. **Wishlist intelligence** — Deal flags, target price alerts, gap-fill scores, Good Deals + Sleeping Beauties insight sections
4. **Data layer foundation** — Drizzle ORM schema, server-only DAL with per-user scoping, Server Actions for all mutations, Supabase Postgres backing store
5. **Authentication** — Supabase Auth via `@supabase/ssr`, `proxy.ts` enforcement, double-verified auth in every Server Action and DAL function, UserMenu with no-JS logout form
6. **Zustand → Postgres migration** — All pages converted to Server Components, Zustand demoted to filter-only state, similarity engine reads from props not stores, `preferencesStore` and `useIsHydrated` deleted entirely
7. **Production deployment** — `horlo.app` live on Vercel + Supabase, verified deploy runbook (`docs/deploy-db-setup.md`) hardened with 6 real footgun fixes from actual execution

**Known gaps:**

- Phase 6 (Test Suite Completion) was not executed — TEST-04, TEST-05, TEST-06 requirements carry forward to v1.1
- 3 MEDIUM code review findings deferred to backlog 999.1 (RLS on public tables, PreferencesClient error swallowing, unused UnauthorizedError import)

---

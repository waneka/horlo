# Horlo

## What This Is

A taste network for watch collectors where collections are identity, people drive discovery, and behavior (owning, wanting, wearing) defines taste. Users explore watches through other collectors — replacing fragmented discovery across YouTube, forums, and marketplaces with a single collection-first, behavior-driven system.

Shipped as a cloud-backed, authenticated web app at [horlo.app](https://horlo.app) — data persists across devices and browsers via Supabase Postgres.

## Core Value

Collectors discover watches through other people's collections and taste — not algorithms, catalogs, or content feeds.

## Requirements

### Validated

- ✓ Watch CRUD — add, edit, delete; status transitions (owned → sold, wishlist → owned) — existing
- ✓ Collection grid — card layout with image, brand/model, key specs — existing
- ✓ Status toggle — owned / wishlist / sold / grail views — existing
- ✓ Filter bar — status, style tags, role tags, dial color filters — existing
- ✓ Tagging system — style, design traits, and role tags per watch — existing
- ✓ User preferences — styles, design traits, complications, dial colors, overlap tolerance — existing
- ✓ Similarity engine — 3-layer scoring (objective similarity → role overlap → preference adjustment) with semantic labels — existing
- ✓ Collection balance analysis — distribution of style, role, dial color across owned watches — existing
- ✓ URL import — 3-stage extraction pipeline (structured data → HTML selectors → LLM fallback) — existing
- ✓ Wear tracking — "mark as worn today" stores lastWornDate on each watch — existing
- ✓ UI polish — spacing, typography, color system, dark/light/system theme toggle — v1.0 (VIS-01/02/03)
- ✓ Better data display — richer watch cards, improved detail view, days-since-worn, balance charts — v1.0 (VIS-04/05/06)
- ✓ Mobile / responsive — usable on phone and tablet — v1.0 (VIS-02)
- ✓ Dark mode — full dark/light mode toggle with system preference detection — v1.0 (VIS-01)
- ✓ SSRF hardening — IP pinning, redirect validation, protocol allowlist — v1.0 (SEC-01)
- ✓ Image security — `next/image` with `remotePatterns` domain allowlist — v1.0 (SEC-02)
- ✓ Fix complicationExceptions — exceptions applied in similarity scoring — v1.0 (FEAT-01)
- ✓ Fix collectionGoal — balanced/specialist/variety influences thresholds and insights — v1.0 (FEAT-02)
- ✓ Wishlist intelligence — deal flags, target price, gap-fill scores, actionable wishlist — v1.0 (FEAT-03/04/05)
- ✓ Wear tracking insights — "haven't worn in X days", Sleeping Beauties panel — v1.0 (VIS-05)
- ✓ UUID watch IDs — `crypto.randomUUID()` replaces Date.now() IDs — v1.0 (FEAT-06)
- ✓ Authentication — Supabase Auth email/password, proxy.ts enforcement, double-verified in DAL + Server Actions — v1.0 (AUTH-01/02/03/04)
- ✓ Cloud persistence — Supabase Postgres via Drizzle ORM, server-only DAL, Server Actions — v1.0 (DATA-01/02/03/04/05)
- ✓ Similarity engine props — receives collection + preferences as props, not Zustand reads — v1.0 (DATA-05)
- ✓ Prod deploy runbook — verified `docs/deploy-db-setup.md` with 6 footgun fixes — v1.0 (OPS-01)
- ✓ Test foundation — Vitest + React Testing Library + MSW configured — v1.0 (TEST-01)
- ✓ Similarity tests — all six SimilarityLabel outputs covered including preference-aware paths — v1.0 (TEST-02)
- ✓ Extractor pipeline tests — structured, HTML, merge logic with fixture HTML — v1.0 (TEST-03)

### Active

- [ ] RLS on all public tables — defense-in-depth, critical for multi-user visibility (carried from v1.0 MR-03)
- [ ] Multi-user data model — follows table, activity tracking, profile/privacy settings
- [ ] Public profiles (self) — profile page with collection, wishlist, worn, notes, stats tabs
- [ ] Collector profiles (other user) — read-only view, follow/unfollow, Common Ground taste overlap
- [ ] Follow system — follow/unfollow users, follower/following counts
- [ ] Home page — network activity feed showing followed users' adds, wishlist changes, wear events
- [ ] Settings — privacy controls for profile, collection, wishlist, wear visibility

### Out of Scope

- Watch linking / canonical watch DB — v2.0 uses independent per-user entries, normalization deferred (Phase 2 of data strategy)
- Image uploads / wrist shots — URL-only for now, Supabase Storage deferred
- WYWT enhancements — keep current wear tracking as-is, enhance in future milestone
- Recommendations / suggested collectors — requires recommendation engine, deferred
- Explore page — structured discovery surface, deferred
- Search across users/watches — deferred
- Notifications — deferred
- Automated price tracking / market integrations / deal alerts — significant infrastructure
- AI recommendation engine — deferred until social foundation is solid
- Collection visualization map — deferred
- Likes, comments, engagement mechanics — explicitly excluded per product vision (Rdio model: discovery, not engagement)
- Zustand watchStore filter tests — carried from v1.0, parked (TEST-04)
- Extract-watch integration test — carried from v1.0, parked (TEST-05)
- Component tests for WatchForm, FilterBar, WatchCard — carried from v1.0, parked (TEST-06)
- PreferencesClient error handling — carried from v1.0, parked (MR-01)
- Custom SMTP for email confirmation — revisit when opening to more users

## Current Milestone: v2.0 Taste Network Foundation

**Goal:** Transform Horlo from a personal collection tool into a multi-user taste network where collectors discover watches through other people's collections and behavior.

**Target features:**
- Multi-user data model with RLS, follows, activity tracking
- Public profiles (self) with 5 tabs: collection, wishlist, worn, notes, stats
- Collector profiles (other user) with Common Ground taste overlap
- Follow system with follower/following counts
- Home page with network activity feed
- Privacy controls for profile, collection, wishlist, wear visibility

## Context

**Current state:** Next.js 16 App Router, React 19, TypeScript 5 strict, Supabase Auth + Postgres, Drizzle ORM, Tailwind CSS 4, Shadcn/base-ui. ~7,958 LOC TypeScript across `src/`. 697 tests passing (18 test files). Deployed at horlo.app on Vercel.

**Architecture:** Server Components by default, Zustand demoted to filter-only ephemeral state (31 lines), server-only DAL for all data access, Server Actions for all mutations, proxy.ts enforces auth at the edge, double-verified in every DAL function and Server Action.

**Production:** Supabase project `wdntzsckjaoqodsyscns`, Vercel deployment at `horlo.app`/`www.horlo.app`. Email confirmation OFF (personal-MVP). Drizzle migrations tracked. Deploy runbook: `docs/deploy-db-setup.md`.

## Constraints

- **Tech stack**: Next.js 16 App Router — continue with existing framework, no rewrites
- **Data model**: Watch and UserPreferences types are established — extend, don't break existing structure
- **Discovery, not engagement**: Rdio-inspired model — social-driven without being a social network. No likes, comments, or engagement mechanics
- **Per-user data isolation**: RLS enforced, privacy controls respected. Multi-user visibility is additive, not a replacement for data safety
- **Performance**: Target <500 watches per user; no need for complex pagination or infinite scroll in MVP

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Local-first with localStorage | Zero backend complexity for MVP, fast iteration | ✓ Completed migration — localStorage replaced by Supabase Postgres in v1.0 |
| URL import with LLM extraction | Product vision said "no external APIs" but the feature was built and adds real value | ✓ Good — SSRF hardened in Phase 1, auth-gated in Phase 4 |
| Semantic similarity labels over raw scores | Scores are confusing; collector language (Core Fit, Role Duplicate) is more actionable | ✓ Good |
| Zustand for state | Simple, no boilerplate, works well with localStorage persist | ✓ Resolved — demoted to filter-only (31 lines) in Phase 5; DB is source of truth |
| App Router only, no pages/ | Clean separation, server components where possible | ✓ Good |
| Supabase Auth + Postgres + Drizzle | Integrated auth+DB, free tier sufficient for personal use, Drizzle for type-safe queries | ✓ Good — deployed and verified in prod |
| DAL + Server Actions (not API routes) | Colocation of data access with auth verification, better type safety | ✓ Good — single POST route remains for extract-watch only |
| proxy.ts + double-verified auth | Defense in depth: proxy.ts for redirects, DAL/SA for data access | ✓ Good — tested via Phase 4 UAT |
| Email confirmation OFF | Personal-MVP posture; free-tier SMTP limited to 2/hour | — Pending — revisit when opening to other users, configure custom SMTP |
| Session-mode pooler for migrations | Direct-connect host is IPv6-only, unreachable on most home ISPs | ✓ Good — documented in runbook |
| Rdio-inspired discovery model | Discovery through people's taste, not algorithms or content feeds. No engagement mechanics (likes/comments). | — Pending |
| No watch linking in v2.0 | Each user's watch entries are independent. Canonical DB / normalization deferred to future data strategy phase. | — Pending |
| URL-only images for v2.0 | Defer Supabase Storage and photo uploads. Keeps scope manageable. | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-19 after v2.0 milestone start — taste network foundation, multi-user profiles + follows + activity feed*

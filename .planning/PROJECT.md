# Horlo

## What This Is

A taste-aware watch collection intelligence system for personal collectors. Users manage their collection and wishlist, understand how their watches relate to each other, and make more intentional buying decisions. The core insight engine evaluates any watch against the user's collection and preferences to produce a semantic label (Core Fit, Role Duplicate, Hard Mismatch, etc.) rather than a raw score.

## Core Value

A collector can evaluate any watch against their collection and get a meaningful, preference-aware answer about whether it adds something or just duplicates what they already own.

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

### Active

**Visual milestone:**
- [ ] UI polish — spacing, typography, color system refinement across all views
- [ ] Better data display — richer watch cards, improved detail view, better insights layout
- [ ] Dark mode — full dark/light mode toggle with system preference detection
- [ ] Mobile / responsive — usable on phone and tablet, not just desktop

**Feature completeness:**
- [ ] Fix complicationExceptions — apply "always allowed" exceptions in similarity scoring (currently stored, never used)
- [ ] Fix collectionGoal — use balanced/specialist/variety-within-theme goal in similarity and insights logic
- [ ] Wishlist intelligence — "good deal" flag per wishlist item, target price workflow, actionable wishlist view
- [ ] Wear tracking insights — "haven't worn in X days" surfaced in detail view and insights panel

**Architecture milestone:**
- [ ] Authentication — full multi-user auth (email/password + OAuth); each user has their own collection
- [ ] Cloud persistence — migrate from localStorage to server-side database; data survives across devices and browsers

**Quality milestone:**
- [ ] Unit tests — similarity engine, extractor pipeline stages, store CRUD logic
- [ ] Integration tests — POST /api/extract-watch route, store filters, preference application

### Out of Scope

- Social / community features (public collections, follow users, activity feed) — future milestone, app is personal-first
- Automated price tracking / market integrations / deal alerts — future milestone, significant infrastructure
- AI recommendation engine (best gap filler, most versatile addition) — future milestone after auth/data layer is solid
- Collection visualization map (2D dressy↔sporty × affordable↔expensive plot) — future milestone
- Sharing / export to others — future milestone once multi-user is established

## Context

**Existing codebase:** Next.js 16 App Router, React 19, TypeScript 5 strict, Zustand 5 with localStorage persist, Tailwind CSS 4, Shadcn/base-ui components. All data is currently local-only in the browser.

**Known issues:**
- `complicationExceptions` and `collectionGoal` preference fields are stored and displayed in the preferences UI but have zero effect on the similarity engine — dead code
- SSRF vulnerability: `/api/extract-watch` is an unauthenticated proxy with no IP blocklist — internal network addresses are reachable server-side
- `watch.imageUrl` rendered as raw `<img src>` without validation or `next/image` domain allowlist
- No data backup mechanism — clearing localStorage destroys the entire collection
- No test coverage of any kind

**Architecture shift planned:** Moving from localStorage-only to full multi-user with cloud persistence is a significant undertaking — requires choosing a database, auth provider, and redesigning all data access patterns.

## Constraints

- **Tech stack**: Next.js 16 App Router — continue with existing framework, no rewrites
- **Data model**: Watch and UserPreferences types are established — extend, don't break existing structure
- **Personal first**: Single-user experience and data isolation must remain correct even after multi-user auth is added
- **Performance**: Target <500 watches per user; no need for complex pagination or infinite scroll in MVP

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Local-first with localStorage | Zero backend complexity for MVP, fast iteration | ⚠️ Revisit — migrating to cloud persistence as explicit goal |
| URL import with LLM extraction | Product vision said "no external APIs" but the feature was built and adds real value | ✓ Good — keep, fix the SSRF issue alongside it |
| Semantic similarity labels over raw scores | Scores are confusing; collector language (Core Fit, Role Duplicate) is more actionable | ✓ Good |
| Zustand for state | Simple, no boilerplate, works well with localStorage persist | — Pending — evaluate when migrating to cloud persistence |
| App Router only, no pages/ | Clean separation, server components where possible | ✓ Good |

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
*Last updated: 2026-04-12 after Phase 3 (Data Layer Foundation) completion — Drizzle schema, server-only DAL, and Server Actions deployed against Supabase Postgres*

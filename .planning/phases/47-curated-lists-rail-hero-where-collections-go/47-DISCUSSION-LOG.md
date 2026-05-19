# Phase 47: Curated Lists Rail + Hero + Where Collections Go - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-19
**Phase:** 47-curated-lists-rail-hero-where-collections-go
**Areas discussed:** Rail card freshness indicator, See-all pages & list detail, Hero selection & rotation, Where Collections Go layout

---

## Rail Card Freshness Indicator

### Form of the indicator

| Option | Description | Selected |
|--------|-------------|----------|
| Relative timestamp | A subtle "Updated 3 days ago" line on every card | |
| 'New' badge only | A "New" badge on recently-published cards; older cards show nothing | |
| Badge + timestamp | A "New" badge on recent cards plus a relative timestamp on all cards | ✓ |

**User's choice:** Badge + timestamp

### Date source

| Option | Description | Selected |
|--------|-------------|----------|
| Use updated_at | No schema change; updated_at as a "last touched" proxy | |
| Add published_at column | New nullable timestamp set on first publish; needs a migration | ✓ |
| Use created_at | No schema change; stable "authored on" date | |

**User's choice:** Add published_at column
**Notes:** Accepts a schema migration (Drizzle + Supabase prod push) in Phase 47 scope. CONTEXT D-03 adds migration backfill (`published_at = created_at` for already-published lists) and extends `setListStatus` to stamp on first publish only.

---

## See-All Pages & List Detail

### /explore/lists layout

| Option | Description | Selected |
|--------|-------------|----------|
| Full grid, same card | Responsive grid of every published list, reusing the rail card | |
| Grid + sort/filter | The full grid plus sort controls (newest, most watches) | ✓ |
| Vertical list rows | One list per full-width row with larger cover + intro preview | |

**User's choice:** Grid + sort/filter

### /explore/paths layout

| Option | Description | Selected |
|--------|-------------|----------|
| Full stack, same card | Every published path with the Where Collections Go card, no rotation | |
| Grouped by path-type | Paths sectioned under their path-type labels | ✓ |

**User's choice:** Grouped by path-type

### List detail page (/explore/lists/[id])

| Option | Description | Selected |
|--------|-------------|----------|
| Watch card + commentary | Vertical sequence of watch cards with commentary below each | |
| Editorial rows | Full-width rows — watch image one side, commentary prose the other | ✓ |

**User's choice:** Editorial rows
**Notes:** Magazine-article feel; rows stack vertically on mobile (image above prose).

---

## Hero Selection & Rotation

### Auto-select rule

| Option | Description | Selected |
|--------|-------------|----------|
| Most recently published | Newest eligible list; deterministic, fully cacheable, no cron | |
| Weekly rotation | Rotate the eligible pool with a week-number cache key, no cron | ✓ |
| Random per load | A different list each load; uncacheable | |

**User's choice:** Weekly rotation
**Notes:** Resolves the EXPL-08 "per page load" vs SEED-008 "weekly cadence" conflict in favour of weekly. Implemented via a deterministic week-index cache key — no cron infrastructure.

### Intro-copy quality gate

| Option | Description | Selected |
|--------|-------------|----------|
| Non-empty is enough | intro_markdown just needs to be present and not blank | ✓ |
| Minimum length | Require intro copy past a small character threshold | |

**User's choice:** Non-empty is enough

---

## Where Collections Go Layout

### Mobile (360px) path rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Numbered vertical stack | Watches stack vertically with number badges + connector line | ✓ |
| Horizontal scroll | Each path is a horizontally-scrollable row of watch cards | |

**User's choice:** Numbered vertical stack

### Which 3 paths show

| Option | Description | Selected |
|--------|-------------|----------|
| Weekly rotation | Rotate 3 of N published paths with a week-number cache key | ✓ |
| Per page load | A fresh random 3 each visit; uncacheable | |
| Fixed by sort order | Always the first 3 by owner sortOrder; never rotates | |

**User's choice:** Weekly rotation
**Notes:** Same week-index mechanism as the Hero — the two rotating modules advance in lockstep via a shared helper.

### Desktop path rendering

| Option | Description | Selected |
|--------|-------------|----------|
| Horizontal sequence | seed → next → next → next left-to-right with connectors | ✓ |
| Same vertical stack | Reuse the mobile numbered vertical stack on desktop too | |

**User's choice:** Horizontal sequence

---

## Claude's Discretion

- The "New" badge recency window (e.g. 7 vs 14 days).
- Relative-timestamp formatting style.
- The week-index derivation function — must be deterministic and shared by Hero and Where Collections Go.
- Cache tag names + `cacheLife` windows for the rail and paths modules (the Hero's `explore:hero` tag is locked).
- Whether `/explore/lists` sort/filter is URL-param-backed or local state.
- Responsive grid column counts; `/explore/paths` section ordering.
- Whether to extract the duplicated `PATH_TYPES` vocab to a shared constant.

## Deferred Ideas

None new from this discussion. Two forward-compat items remain tracked in REQUIREMENTS.md § Future Requirements and out of Phase 47 scope: the `featured_collector` Hero format, and computed collection paths.

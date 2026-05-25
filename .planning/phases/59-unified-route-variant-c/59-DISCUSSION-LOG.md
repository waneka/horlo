# Phase 59: Unified Route (Variant C) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-25
**Phase:** 59-unified-route-variant-c
**Areas discussed:** Ref form in the URL, One URL vs two per watch, Owner via discovery link, Edit & add-watch scope

---

## Ref identity (Ref form in the URL)

| Option | Description | Selected |
|--------|-------------|----------|
| Natural id per surface | Ownership surfaces link by `watches.id` (addresses specific copy, carries per-copy data); discovery surfaces link by `catalogId`. Route resolves either. Tradeoff: owned watch has two resolvable URLs. | ✓ |
| Always catalog id | One URL per watch; route always detects ownership + layers per-user data. Literal "single canonical URL". Tradeoff: can't address a specific copy if you own duplicates. | |
| Prefixed / typed ref | Encode kind in ref (`/w/u-…` vs `/w/c-…`) → one deterministic lookup, no fallback ambiguity. Tradeoff: uglier URL; surfaces must emit the right prefix. | |

**User's choice:** Natural id per surface.
**Notes:** Foundational fork raised by Claude — `watches.catalogId` is a NOT-NULL FK so catalog-id-only is technically possible, but a collector can own duplicate copies of one reference and per-user data is per-copy, so only `watches.id` addresses a specific copy. This answer cascaded: resolution = raw-UUID try-per-user-then-catalog; an owned watch having two resolvable `/w/` URLs is accepted (consistent with ROUTE-01 = one *route*, either id). Prefixing explicitly rejected.

---

## Owner via discovery link (folds in "One URL vs two per watch")

| Option | Description | Selected |
|--------|-------------|----------|
| Full owned view in place | Catalog branch detects ownership (`findViewerWatchByCatalogId`), loads full Watch, renders owned framing + `WatchDetail` island + write actions at `/w/[catalogId]`. No redirect. Cost: catalog branch carries ownership-layering (inherent Variant C work, NOT the buggy D-08 flip). | ✓ |
| Cross-user view + "open your copy" link | Owner sees the same discovery/spec view + a small link to their `watches.id` URL. Simplest catalog branch. Cost: lesser view via discovery; revives D-08 "you own this" callout. | |
| Page-level redirect to `watches.id` | Server-side `next/navigation` redirect to `/w/[watches.id]`. Single clean experience. Cost: reintroduces a redirect on a hot path; ambiguous target with duplicate copies; counter to no-redirect philosophy. | |

**User's choice:** Full owned view in place.
**Notes:** "One URL vs two per watch" was folded here — the natural-id choice already implied two resolvable URLs and ROUTE-01 is satisfied by one route resolving either id. Key captured consequence: ownership is decided by the viewer's relationship to the watch, not by which id the URL carried; both resolution branches converge on the same framing dispatch. No redirect anywhere — including unwinding the 50.1 Variant B redirect (ARCH-02).

---

## Route scope (Edit & add-watch scope)

| Option | Description | Selected |
|--------|-------------|----------|
| Move edit, keep /watch/new | `/watch/[id]/edit` → `/w/[ref]/edit` (follows its detail route). `/watch/new` stays — v8.0 Add-Watch Redesign reworks it. CI guard bans detail paths with `/watch/new` allowlisted. | ✓ |
| Move everything under /w/ | `/w/[ref]/edit` AND `/w/new`. Cleanest guard ("no /watch/ or /catalog/ anywhere"). Cost: also rewrites 10+ `/watch/new` linkers, churning a flow v8.0 will redesign. | |
| Detail routes only | Leave both `/watch/new` AND `/watch/[id]/edit`. Smallest blast radius, but edit orphaned at `/watch/[id]/edit` while detail is `/w/[ref]`; guard must allowlist both. | |

**User's choice:** Move edit, keep /watch/new.
**Notes:** Decision shaped by v8.0 Add-Watch Redesign (SEED-010) reworking `/watch/new` anyway — avoid churn. Edit follows its detail route for consistency. CI guard scope set accordingly (bans `/watch/<id>` + `/catalog/<id>`, allowlists `/watch/new`, must catch computed `resolveHref` strings).

---

## Claude's Discretion

- CI guard exact mechanism (custom test-runner check vs ESLint rule vs typed routes) — build-failing + scope are the locked constraints.
- 404/not-found UX for legacy paths — Next default `not-found` acceptable.
- Physical merge of the server-only catalog page + client-island watch page into one `/w/[ref]/page.tsx` (B1-invariant composition) — behavior locked, mechanism open.
- `OtherOwnersRoster` / `CatalogPageActions` per-viewer-state visibility on the unified route — carried as a planner forcing-function note (spike §4.D/E); resolve here or defer to Phase 64.

## Deferred Ideas

- `/watch/new` → `/w/new` relocation — deferred to v8.0 Add-Watch Redesign (SEED-010).
- CI guard → typed-route enforcement (prevent, not just detect) — out of scope; ship the build-failing static scan now.
- Photos / carousel / wear-pic surfacing / grid engagement / IA redesign — Phases 60-64.

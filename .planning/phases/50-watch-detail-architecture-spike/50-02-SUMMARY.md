---
phase: 50-watch-detail-architecture-spike
plan: "02"
subsystem: documentation
tags: [architecture, spike, watch-detail, variants, cost-estimate]

# Dependency graph
requires:
  - phase: 50-watch-detail-architecture-spike
    plan: "01"
    provides: "50-SPIKE.md §1-3 scaffold + trailing --- separator signaling Plan 02 append point"
provides:
  - 50-SPIKE.md §4 Variants A-E — five subsections (A-E) with routing model, per-user data shape, entry-point disruption, one-sentence Summary
  - 50-SPIKE.md §7 Cost Estimate per Variant — side-by-side 5-row table × 6 columns sourced from RESEARCH Per-Variant File Impact Summary
affects:
  - "50-03-PLAN.md — Plan 03 splices §5 (v7.0 Lens) + §6 (Decision Matrix) BETWEEN §4 and §7 using Edit against the ## 7. heading anchor"
  - "50-04-PLAN.md — Plan 04 appends §8 + §9 after the --- separator following §7"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Spike §4 Variants: declarative variant subsections with routing model / per-user data shape / entry-point disruption / Summary line per variant (mirrors 49-SPIKE.md §Options shape)"
    - "LANDMINE callout pattern for proxy.ts Router Cache poisoning in URL canonicalization variant documentation"

key-files:
  created: []
  modified:
    - ".planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md"

key-decisions:
  - "Variant B landmine is documented as a hard rejection — proxy.ts 307 on RSC prefetch poisons Next 16 Router Cache; canonicalization MUST be at page level via next/navigation redirect() confirmed by node_modules/next/dist/docs/01-app/02-guides/redirecting.md:41"
  - "Phase 48 BUG-01 is named in §4.B as the bug class Variant B retires — the self-via-cross-user framing flip carries ongoing maintenance tax that any variant with a redirect replaces"
  - "§7 placed directly after §4 (not after §5/§6) per D-SKEL-02 so Plan 03 can Edit-insert §5/§6 above the ## 7. anchor"
  - "Variant D per-user fields enumerated from src/db/schema.ts:130,140,153 — strapType, notes, isFlaggedDeal, acquisitionDate, sortOrder, condition, boxPapers"
  - "Variant E shim precedent named: catalogEntryToSimilarityInput in src/lib/verdict/shims.ts is the synthesize-from-CatalogEntry pattern"
  - "§7 cost rows sourced verbatim from RESEARCH Per-Variant File Impact Summary (lines 277-284) with planner voice in cells"

requirements-completed: [ARCH-01]

# Metrics
duration: 5min
completed: 2026-05-20
---

# Phase 50 Plan 02: Watch-Detail Architecture Spike §4 + §7 Summary

**§4 Variants A-E (five routing-model subsections) and §7 Cost Estimate per Variant (side-by-side 5-row table) appended to 50-SPIKE.md — evidence base for Plan 03's Decision Matrix scoring**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-05-20T17:24:07Z
- **Completed:** 2026-05-20T17:29:01Z
- **Tasks:** 2
- **Files modified:** 1 (50-SPIKE.md only — D-GUARD-01 enforcement)

## Accomplishments

### Task 1: §4 Variants A-E

Appended `## 4. Variants A-E` after §3's closing `---` separator. Five subsections produced:

- **§4.A Keep separate** — zero-change no-op; framing flip maintenance tax documented
- **§4.B URL canonicalization** — next/navigation `redirect()` at page level; mandatory LANDMINE callout with MEMORY `feedback_proxy_router_cache_poisoning` cited verbatim; Phase 48 BUG-01 named as the bug class Variant B retires; proxy.ts sub-variant rejected on first principles
- **§4.C Single unified /w/[ref]** — new route + 2 redirect shells + 19 entry-point rewrites; cleanest composition, highest blast radius
- **§4.D Absorb watch→catalog** — per-user fields from `src/db/schema.ts:130,140,153`; 12 entry-point rewrites; `OtherOwnersRoster` UI-SPEC forcing-function noted
- **§4.E Absorb catalog→watch** — `catalogEntryToSimilarityInput` shim cited as synthesis precedent; UUID-space dispatch fragility noted; 7 entry-point rewrites; `CatalogPageActions` conditional-render requirement noted

Each variant ends with a one-sentence **Summary** line. `---` separator follows §4.E.

### Task 2: §7 Cost Estimate per Variant

Appended `## 7. Cost Estimate per Variant` directly after §4's separator (before §5/§6 which Plan 03 owns). Table has:
- 5 rows (A-E) × 6 columns (Variant | Files touched | Entry-point rewrites | Migrations | DAL changes | Test surface)
- Row contents sourced from RESEARCH §Per-Variant File Impact Summary (lines 277-284)
- All 5 variants show 0 migrations — route+UI-only changes confirmed

Carve-out paragraph immediately below table:
- Cites MEMORY `project_db_wipeable_2026_05_09` (updated 2026-05-19) — `watches_catalog` is NOT wipeable
- Names D-GUARD-01 as the guardrail that scopes v7.0 photo schema cost out of Phase 50
- Notes §5 (owned by Plan 03) will connect to the same carve-out from the photo-schema cost angle

`---` separator follows §7, signaling Plan 04's append point for §8+§9.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Append §4 Variants A-E | e795ab1 | `.planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md` |
| 2 | Append §7 Cost Estimate per Variant | 709c02a | `.planning/phases/50-watch-detail-architecture-spike/50-SPIKE.md` |

## Section Anchors for Plan 03

Plan 03 must insert §5 (v7.0 Lens) and §6 (Decision Matrix) BETWEEN §4 and §7. The splice point is the `## 7. Cost Estimate per Variant` heading. Plan 03 should use Edit with:
- `old_string`: `## 7. Cost Estimate per Variant`
- `new_string`: `## 5. v7.0 Watch Photos Lens\n\n...\n\n---\n\n## 6. Decision Matrix\n\n...\n\n---\n\n## 7. Cost Estimate per Variant`

After Plan 03's splice, the SPIKE.md section order will be: §1, §2, §3, §4, §5, §6, §7 — then Plan 04 appends §8 and §9.

## Key Evidence Transcribed

### Variant B — LANDMINE (mandatory check)

The proxy.ts router-cache poisoning landmine is called out explicitly in §4.B per RESEARCH Pitfall 2 + MEMORY `feedback_proxy_router_cache_poisoning`. The Next.js 16 docs confirm (verified from `node_modules/next/dist/docs/01-app/02-guides/redirecting.md:41`) that `redirect()` from `next/navigation` is the Server Component API. `NextResponse.redirect` is the proxy-layer API and is what causes the Router Cache poisoning. Any implementation of Variant B must use the page-level API.

### Variant D — per-user fields

Fields the catalog page must thread in when owner detected: strapType, notes, isFlaggedDeal, acquisitionDate, sortOrder, condition, boxPapers. These are at `src/db/schema.ts:130,140,153` on the `watches` table and are NOT present on `watches_catalog` (`src/db/schema.ts:335-404`).

### Variant E — synthesis precedent

`catalogEntryToSimilarityInput` in `src/lib/verdict/shims.ts` is the existing precedent for synthesizing a `Watch`-shaped object from a `CatalogEntry`. The "no per-user row yet" mode in Variant E reuses this pattern.

### §7 — catalog NOT wipeable

`watches_catalog` is NOT wipeable per `project_db_wipeable_2026_05_09` (updated 2026-05-19). None of variants A-E require a catalog migration — but if v7.0 photo schema lands in a Phase 50.1 implementation, any ALTER to `watches_catalog` must be in-place ALTER+UPDATE, not wipe-and-re-seed.

## Deviations from Plan

None — plan executed exactly as written. All five variant subsections match the exact heading patterns required. The landmine callout in §4.B, BUG-01 retirement, schema.ts line citations, and catalogEntryToSimilarityInput citation are all present. §7 rows sourced directly from RESEARCH without re-derivation.

## Known Stubs

None. This plan produces documentation-only content. No data stubs, no empty components, no placeholder text in the deliverable.

## Threat Flags

None. D-GUARD-01 enforcement confirmed — zero files outside `.planning/phases/50-watch-detail-architecture-spike/` modified. No new network endpoints, auth paths, file access patterns, or schema changes introduced.

---
*Phase: 50-watch-detail-architecture-spike*
*Completed: 2026-05-20*

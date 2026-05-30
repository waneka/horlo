---
status: obsolete
marked_obsolete: 2026-05-29
marked_during: v8.1 kickoff (/gsd-new-milestone)
superseded_by: v7.0 Phase 59 (Unified Route — Variant C hard cutover)
---

# OBSOLETE — Route Deleted

This quick task (planted 2026-04-21) targeted `src/app/watch/[id]/page.tsx` and proposed a
new `getWatchByIdForViewer` privacy-aware DAL. That route **no longer exists**.

## What changed

In **v7.0 Phase 59** (shipped 2026-05-25), the `/watch/[id]` and `/catalog/[catalogId]`
routes were collapsed into a single canonical `/w/[ref]` route via a hard cutover (no
redirect — both legacy page files deleted; 26 link literals across 21 files re-pointed).
Privacy gating lives at the unified `/w/[ref]` page level with `findViewerWatchByCatalogId`
in `src/data/watches.ts`, NOT a separate `getWatchByIdForViewer` DAL.

See `.planning/milestones/v7.0-phases/59-*/` for the full record.

## Why filename suggested adjacency to v8.1 ROUTE-01

ROUTE-01 (captured 2026-05-29 during v8.0 prod UAT) is about the **NEW** `/w/[ref]` route
resolving 404 when the owned auto-redirect fires from a search-pick. Different surface,
different bug — confusable only because both filenames mention "404 on watch detail."
ROUTE-01's fix is part of v8.1 polish; this quick_task is not folded in.

## Action

Leaving the dir in place as a historical record. Audit-open output should ignore this
task post-OBSOLETE marker. Future seeds audits can `git rm -r` if desired.
